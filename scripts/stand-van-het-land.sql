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
        -- Restoration need (Don, 2026-09-25): D or E on droogstand or ontwateringsdiepte
        -- only, as FunderConsult counts it. Worst-of-four adds ~104k wood panden that
        -- the bacterial rule puts at D by pile length alone (EUR 18.1bn -> 58.6bn).
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
),
obs AS (
    -- The database figures shared with fundermaps.com/hoe-het-model-werkt.html:
    -- waarnemingen = samples from research, archive, notes, Verkennend
    -- Funderingsonderzoek and herstel;
    -- vastgelegde waarden = the filled fields in those samples.
    SELECT count(*) AS n,
           sum((SELECT count(*) FROM jsonb_each(to_jsonb(s) - ARRAY['id','inquiry_id','address','create_date','update_date','delete_date','building_id','metadata']) e
                WHERE e.value NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb))) AS v
    FROM report.inquiry_sample s JOIN report.inquiry i ON i.id = s.inquiry_id
    WHERE s.delete_date IS NULL AND i.delete_date IS NULL
    UNION ALL
    SELECT count(*),
           sum((SELECT count(*) FROM jsonb_each(to_jsonb(r) - ARRAY['id','recovery_id','create_date','update_date','delete_date','building_id','metadata']) e
                WHERE e.value NOT IN ('null'::jsonb, '""'::jsonb)))
    FROM report.recovery_sample r WHERE r.delete_date IS NULL
)
SELECT json_build_object(
    'generated_at', now(),
    'database', (
        SELECT json_build_object(
            'observations', sum(n),
            'values', sum(v),
            'researched', (SELECT count(DISTINCT s.building_id)
                           FROM report.inquiry_sample s JOIN report.inquiry i ON i.id = s.inquiry_id
                           WHERE s.delete_date IS NULL AND i.delete_date IS NULL AND s.foundation_type IS NOT NULL
                             AND i.type NOT IN ('quickscan', 'facade_scan'))
        ) FROM obs
    ),
    'model_version', 'model-2024.1',
    'coverage', (
        SELECT json_build_object(
            'buildings', count(*),
            'addresses', sum(address_count),
            'municipalities', count(DISTINCT municipality_id),
            'districts', count(DISTINCT district_id),
            'neighborhoods', count(DISTINCT neighborhood_id),
            -- Herstelde panden: the Nationaal Herstel Register total (stand 2026-09-21),
            -- set by hand until the register is fully in FunderMaps (Don, 2026-09-25).
            'restored', 30122
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
    -- Restoration costs only for panden that need it: D or E on droogstand or
    -- ontwateringsdiepte (Don, 2026-09-25), per foundation family. Averages leave out the most expensive
    -- 10% per family (Don 2026-09-24): a few very large panden with many
    -- addresses pull a plain mean far above a typical pand. Totals count all.
    'costs', (
        SELECT json_build_object(
            'de_with_cost', count(restoration_costs) FILTER (WHERE urgent),
            'de_total', sum(restoration_costs) FILTER (WHERE urgent),
            'families', (
                SELECT json_agg(json_build_object(
                    'family', f.family,
                    'buildings', f.buildings,
                    'de_buildings', f.de_buildings,
                    'de_with_cost', f.de_with_cost,
                    'de_avg', f.de_avg,
                    'de_total', f.de_total) ORDER BY f.family DESC)
                FROM (
                    SELECT b2.family,
                           count(*) AS buildings,
                           count(*) FILTER (WHERE b2.urgent) AS de_buildings,
                           count(b2.restoration_costs) FILTER (WHERE b2.urgent) AS de_with_cost,
                           round(avg(b2.restoration_costs) FILTER (WHERE b2.urgent AND b2.restoration_costs <= q.p90)) AS de_avg,
                           sum(b2.restoration_costs) FILTER (WHERE b2.urgent) AS de_total
                    FROM b b2
                    JOIN (SELECT family, percentile_cont(0.9) WITHIN GROUP (ORDER BY restoration_costs) AS p90
                          FROM b WHERE urgent AND restoration_costs IS NOT NULL GROUP BY family) q USING (family)
                    WHERE b2.family IN ('wood', 'shallow')
                    GROUP BY b2.family
                ) f
            )
        )
        FROM b
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
