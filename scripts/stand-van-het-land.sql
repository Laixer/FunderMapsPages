-- Stand van het Land: national figures for fundermaps.com/stand-van-het-land.html.
--
-- Read-only. Returns ONE json document; save it as src/data/stand-van-het-land.json:
--   psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
--     -f scripts/stand-van-het-land.sql > src/data/stand-van-het-land.json
--
-- Source: maplayer.building_tiles (every pand with an address, refreshed nightly
-- from the current model), report.recovery_sample and dataops.dossier.
-- Risk class of a pand = its worst class over the four model risks (A best, E worst).
WITH b AS MATERIALIZED (
    SELECT
        t.municipality_id,
        t.district_id,
        t.neighborhood_id,
        t.address_count,
        t.restoration_costs,
        CASE
            WHEN t.construction_year IS NULL OR t.construction_year > extract(year FROM now()) THEN NULL
            WHEN t.construction_year < 1850 THEN 1840
            ELSE t.construction_year / 10 * 10
        END AS decade,
        CASE
            WHEN t.foundation_type LIKE 'wood%' THEN 'wood'
            WHEN t.foundation_type LIKE 'no_pile%' THEN 'shallow'
            WHEN t.foundation_type IN ('concrete', 'weighted_pile', 'steel_pile') THEN 'concrete'
            ELSE 'other'
        END AS family,
        upper(greatest(t.drystand_risk, t.bio_infection_risk, t.dewatering_depth_risk, t.unclassified_risk)) AS risk_class,
        -- Restoration need as FunderConsult counted it: D/E on drystand or dewatering depth only.
        t.drystand_risk IN ('d', 'e') OR t.dewatering_depth_risk IN ('d', 'e') AS urgent
    FROM maplayer.building_tiles t
),
feedback AS (
    SELECT 'incident_portal' AS source, NULL::text AS outcome, NULL::interval AS lead_time
    FROM report.incident WHERE delete_date IS NULL
    UNION ALL
    SELECT CASE channel WHEN 'upload' THEN 'melden' ELSE 'archive' END, outcome::text, outcome_at - received_at
    FROM dataops.dossier
    WHERE channel IN ('upload', 'bulk_drop') AND audit_inquiry_id IS NULL
)
SELECT json_build_object(
    'generated_at', now(),
    'model_version', 'model-2024.1',
    'coverage', (
        SELECT json_build_object(
            'buildings', count(*),
            'addresses', sum(address_count),
            'municipalities', count(DISTINCT municipality_id),
            'districts', count(DISTINCT district_id),
            'neighborhoods', count(DISTINCT neighborhood_id),
            'restored', (SELECT count(DISTINCT building_id) FROM report.recovery_sample WHERE delete_date IS NULL)
        ) FROM b
    ),
    'families', (
        SELECT json_agg(json_build_object('family', family, 'buildings', n, 'addresses', a) ORDER BY n DESC)
        FROM (SELECT family, count(*) AS n, sum(address_count) AS a FROM b GROUP BY family) f
    ),
    'risk_table', (
        SELECT json_agg(json_build_object('class', risk_class, 'buildings', n, 'addresses', a) ORDER BY risk_class DESC)
        FROM (
            SELECT risk_class, count(*) AS n, sum(address_count) AS a
            FROM b WHERE family IN ('wood', 'shallow') AND risk_class IS NOT NULL
            GROUP BY risk_class
        ) r
    ),
    'family_risk', (
        SELECT json_agg(json_build_object('family', family, 'class', risk_class, 'buildings', n) ORDER BY family, risk_class)
        FROM (SELECT family, risk_class, count(*) AS n FROM b WHERE risk_class IS NOT NULL GROUP BY 1, 2) r
    ),
    'decade_risk', (
        SELECT json_agg(json_build_object('decade', decade, 'class', risk_class, 'buildings', n) ORDER BY decade, risk_class)
        FROM (SELECT decade, risk_class, count(*) AS n FROM b WHERE decade IS NOT NULL AND risk_class IS NOT NULL GROUP BY 1, 2) r
    ),
    'decade_family', (
        SELECT json_agg(json_build_object('decade', decade, 'family', family, 'buildings', n) ORDER BY decade, family)
        FROM (SELECT decade, family, count(*) AS n FROM b WHERE decade IS NOT NULL GROUP BY 1, 2) r
    ),
    -- Averages leave out the most expensive 10% per group (Don 2026-09-24): a few very
    -- large panden with many addresses pull a plain mean far above a typical pand.
    'costs', (
        SELECT json_build_object(
            'with_cost', count(restoration_costs),
            'avg', round(avg(restoration_costs) FILTER (WHERE restoration_costs <= p.all_p90)),
            'shallow_with_cost', count(restoration_costs) FILTER (WHERE family = 'shallow'),
            'shallow_avg', round(avg(restoration_costs) FILTER (WHERE family = 'shallow' AND restoration_costs <= p.shallow_p90)),
            'wood_with_cost', count(restoration_costs) FILTER (WHERE family = 'wood'),
            'wood_avg', round(avg(restoration_costs) FILTER (WHERE family = 'wood' AND restoration_costs <= p.wood_p90)),
            'de_with_cost', count(restoration_costs) FILTER (WHERE urgent),
            'de_total', sum(restoration_costs) FILTER (WHERE urgent)
        )
        FROM b, (
            SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY restoration_costs) AS all_p90,
                   percentile_cont(0.9) WITHIN GROUP (ORDER BY restoration_costs) FILTER (WHERE family = 'shallow') AS shallow_p90,
                   percentile_cont(0.9) WITHIN GROUP (ORDER BY restoration_costs) FILTER (WHERE family = 'wood') AS wood_p90
            FROM b WHERE restoration_costs IS NOT NULL
        ) p
    ),
    'cost_bands', (
        SELECT json_agg(json_build_object('family', family, 'band', band, 'buildings', n) ORDER BY family, band)
        FROM (
            SELECT family,
                   CASE WHEN restoration_costs < 25000 THEN 0
                        WHEN restoration_costs < 50000 THEN 1
                        WHEN restoration_costs < 100000 THEN 2
                        WHEN restoration_costs < 200000 THEN 3
                        ELSE 4 END AS band,
                   count(*) AS n
            FROM b WHERE restoration_costs IS NOT NULL AND family IN ('wood', 'shallow')
            GROUP BY 1, 2
        ) c
    ),
    'feedback', (
        SELECT json_build_object(
            'total', count(*),
            'by_source', (SELECT json_object_agg(source, n) FROM (SELECT source, count(*) AS n FROM feedback GROUP BY 1) s),
            'handled_pct', round(100.0 * count(*) FILTER (WHERE outcome IS NOT NULL)
                                 / nullif(count(*) FILTER (WHERE source <> 'incident_portal'), 0)),
            'melden_median_hours', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM lead_time) / 3600)
                                          FILTER (WHERE source = 'melden'))::numeric, 1),
            'risk_recalculated', (SELECT count(*) FROM dataops.dossier_mail WHERE kind = 'risk_changed' AND status = 'sent')
        ) FROM feedback
    )
);
