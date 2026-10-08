// Renders stand-van-het-land.html from src/data/stand-van-het-land.json,
// which scripts/stand-van-het-land.py produces from the FunderMaps database.
// The national figures are the top level; `provinces` holds the pand figures
// per province (Don, 2026-10-08), and picking one redraws the same charts and
// tables from those. Database, Verkennend Funderingsonderzoek and feedback
// figures are national only and say so when a province is shown.
import data from "../../data/stand-van-het-land.json"

/** What is drawn now: the country, or the country with one province's pand figures on top. */
let view = data
let scope = ""

const CLASSES = ["A", "B", "C", "D", "E"]
const FAMILIES = ["wood", "concrete", "shallow"]
const FAMILY_LABEL = {
  wood: "Houten paalfundering",
  concrete: "Betonpaalfundering",
  shallow: "Ondiepe fundering (op staal)",
  other: "Overige funderingen",
}
const BANDS = ["< € 25.000", "€ 25.000 – 50.000", "€ 50.000 – 100.000", "€ 100.000 – 200.000", "≥ € 200.000"]

const nf = new Intl.NumberFormat("nl-NL")
const pf = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const num = (n) => nf.format(n)
const pct = (part, total) => (total ? pf.format((100 * part) / total) + "%" : "–")
const euro = (n) => (n == null ? "–" : "€ " + nf.format(n))
const billions = (n) =>
  n == null ? "–" : "€ " + new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(n / 1e9) + " miljard"
const decadeLabel = (d) => (d < 1850 ? "< 1850" : d + "s")

const el = (tag, cls, text) => {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

// Sum `buildings` of rows matching every key in `where`.
const sum = (rows, where = {}) =>
  rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).reduce((s, r) => s + r.buildings, 0)

function fillFigures() {
  const c = view.coverage
  // A province can lack a family, or panden with D/E costs (Flevoland): zeros, not an error.
  const none = { buildings: 0, addresses: 0, de_buildings: 0, de_with_cost: 0, de_avg: null, de_total: 0 }
  const fam = { wood: none, shallow: none, ...Object.fromEntries((view.families || []).map((f) => [f.family, f])) }
  const k = view.costs || { de_total: 0, de_with_cost: 0, families: [] }
  const kf = { wood: none, shallow: none, ...Object.fromEntries((k.families || []).map((f) => [f.family, f])) }
  const values = {
    scope: scope || "Nederland",
    updated: new Date(view.generated_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }),
    model: view.model_version,
    buildings: num(c.buildings),
    addresses: num(c.addresses),
    municipalities: num(c.municipalities),
    districts: num(c.districts),
    neighborhoods: num(c.neighborhoods),
    restored: c.restored == null ? "–" : num(c.restored),
    wood: num(fam.wood.buildings),
    wood_pct: pct(fam.wood.buildings, c.buildings),
    shallow: num(fam.shallow.buildings),
    shallow_pct: pct(fam.shallow.buildings, c.buildings),
    de_total: billions(k.de_total),
    de_with_cost: num(k.de_with_cost),
    de_wood_n: num(kf.wood.de_buildings),
    de_wood_pct: pct(kf.wood.de_buildings, kf.wood.buildings),
    de_wood_avg: euro(kf.wood.de_avg),
    de_wood_total: billions(kf.wood.de_total),
    de_shallow_n: num(kf.shallow.de_buildings),
    de_shallow_pct: pct(kf.shallow.de_buildings, kf.shallow.buildings),
    de_shallow_avg: euro(kf.shallow.de_avg),
    de_shallow_total: billions(kf.shallow.de_total),
    db_observations: num(view.database.observations),
    db_values: num(view.database.values),
    db_researched: num(view.database.researched),
    vfo_reports: num(view.verkennend.reports),
    vfo_buildings: num(view.verkennend.buildings),
    vfo_last12: num(view.verkennend.last_12),
    fb_total: num(view.feedback.total),
    fb_portal: num(view.feedback.by_source.incident_portal || 0),
    fb_archive: num(view.feedback.by_source.archive || 0),
    fb_melden: num(view.feedback.by_source.melden || 0),
    fb_hours: pf.format(view.feedback.melden_median_hours),
    fb_recalculated: num(view.feedback.risk_recalculated),
  }
  document.querySelectorAll("[data-svl]").forEach((node) => {
    const v = values[node.dataset.svl]
    if (v !== undefined) node.textContent = v
  })
}

// One tall 100% bar with the family names in their segments, and a card with
// the illustration per family below (the FunderConsult composition).
const FAMILY_IMAGE = {
  wood: new URL("../images/foundation/houtenpaal_fundering.svg", import.meta.url),
  concrete: new URL("../images/foundation/betonpaal_fundering.svg", import.meta.url),
  shallow: new URL("../images/foundation/ondiepe_fundering.svg", import.meta.url),
}
const FAMILY_COLOR = { wood: "var(--svl-fam-wood)", concrete: "var(--svl-fam-concrete)", shallow: "var(--svl-fam-shallow)" }

function familyShare(root) {
  const total = view.coverage.buildings
  const bar = el("div", "svl-famshare")
  const cards = el("div", "svl-famcards")
  for (const f of [...FAMILIES, "other"]) {
    const row = view.families.find((r) => r.family === f)
    if (!row) continue
    const share = (100 * row.buildings) / total
    const seg = el("span", `svl-famshare__seg svl-fam-${f}`, share >= 3 ? FAMILY_LABEL[f] : "")
    seg.style.width = share + "%"
    seg.title = `${FAMILY_LABEL[f]}: ${pct(row.buildings, total)}`
    bar.append(seg)
    if (!FAMILY_IMAGE[f]) continue
    const card = el("div", "svl-famcard")
    const img = el("img", "svl-famcard__img")
    img.src = FAMILY_IMAGE[f]
    img.alt = FAMILY_LABEL[f]
    img.loading = "lazy"
    img.style.borderColor = FAMILY_COLOR[f]
    card.append(img, el("span", "svl-famcard__name", FAMILY_LABEL[f]), el("span", "svl-famcard__note", `${pct(row.buildings, total)} · ${num(row.buildings)} panden`))
    cards.append(card)
  }
  root.append(bar, cards)
}

function riskTable(root) {
  const rows = view.risk_table
  const total = rows.reduce((s, r) => s + r.buildings, 0)
  const tbody = root.querySelector("tbody")
  for (const cls of [...CLASSES].reverse()) {
    const r = rows.find((x) => x.class === cls) || { buildings: 0, addresses: 0 }
    const tr = el("tr")
    const th = el("th", "")
    th.scope = "row"
    th.append(el("span", `svl-chip svl-risk--${cls.toLowerCase()}`, cls))
    th.append(document.createTextNode(" Klasse " + cls))
    const share = el("td", "svl-share")
    const bar = el("span", `svl-inline-bar svl-risk--${cls.toLowerCase()}`)
    bar.style.width = (100 * r.buildings) / total + "%"
    share.append(bar, el("span", "", pct(r.buildings, total)))
    tr.append(th, el("td", "", num(r.buildings)), el("td", "", num(r.addresses)), share)
    tbody.append(tr)
  }
}

// Stacked A–E bar per foundation family.
function familyRisk(root) {
  for (const f of [...FAMILIES, "other"]) {
    const total = sum(view.family_risk, { family: f })
    if (!total) continue
    const row = el("div", "svl-stack-row")
    const head = el("div", "svl-stack-head")
    head.append(el("strong", "", FAMILY_LABEL[f]), el("span", "svl-muted", num(total) + " panden"))
    const bar = el("div", "svl-bar")
    for (const cls of CLASSES) {
      const n = sum(view.family_risk, { family: f, class: cls })
      if (!n) continue
      const seg = el("span", `svl-seg svl-risk--${cls.toLowerCase()}`)
      seg.style.width = (100 * n) / total + "%"
      seg.title = `Klasse ${cls}: ${pct(n, total)} · ${num(n)} panden`
      if (n / total > 0.06) seg.textContent = cls
      bar.append(seg)
    }
    const detail = el("p", "svl-muted svl-small")
    detail.textContent = CLASSES.map((cls) => `${cls} ${pct(sum(view.family_risk, { family: f, class: cls }), total)}`).join(" · ")
    row.append(head, bar, detail)
    root.append(row)
  }
  root.append(riskLegend())
}

function riskLegend() {
  const legend = el("ul", "svl-legend svl-legend--inline")
  for (const cls of CLASSES) {
    const li = el("li")
    li.append(el("span", `svl-swatch svl-risk--${cls.toLowerCase()}`), el("span", "", "Klasse " + cls))
    legend.append(li)
  }
  return legend
}

// Heatmap: share of each risk class within a construction decade.
function decadeRisk(root) {
  const decades = [...new Set(view.decade_risk.map((r) => r.decade))].sort((a, b) => a - b)
  const table = el("table", "svl-heat")
  const thead = el("thead")
  const hr = el("tr")
  hr.append(el("th", "", "Klasse"))
  decades.forEach((d) => hr.append(el("th", "", decadeLabel(d))))
  thead.append(hr)
  const tbody = el("tbody")
  for (const cls of [...CLASSES].reverse()) {
    const tr = el("tr")
    const th = el("th")
    th.scope = "row"
    th.append(el("span", `svl-chip svl-risk--${cls.toLowerCase()}`, cls))
    tr.append(th)
    for (const d of decades) {
      const total = sum(view.decade_risk, { decade: d })
      const share = total ? sum(view.decade_risk, { decade: d, class: cls }) / total : 0
      const td = el("td", "", pct(share * total, total))
      td.style.setProperty("--heat", Math.min(0.6, share).toFixed(3))
      td.style.setProperty("--heat-color", `var(--svl-risk-${cls})`)
      tr.append(td)
    }
    tbody.append(tr)
  }
  table.append(thead, tbody)
  root.append(table)
}

// 100% stacked column per decade: foundation family mix over time.
function decadeFamily(root) {
  const decades = [...new Set(view.decade_family.map((r) => r.decade))].sort((a, b) => a - b)
  const chart = el("div", "svl-columns")
  for (const d of decades) {
    // Shares of the three drawn families only, so every column is full height.
    const total = ["shallow", "concrete", "wood"].reduce((s, f) => s + sum(view.decade_family, { decade: d, family: f }), 0)
    const col = el("div", "svl-col")
    const stack = el("div", "svl-col__stack")
    stack.title = `${decadeLabel(d)}: ${num(total)} panden`
    for (const f of ["shallow", "concrete", "wood"]) {
      const n = sum(view.decade_family, { decade: d, family: f })
      const seg = el("span", `svl-col__seg svl-fam-${f}`)
      seg.style.height = (100 * n) / total + "%"
      seg.title = `${decadeLabel(d)} · ${FAMILY_LABEL[f]}: ${pct(n, total)}`
      stack.append(seg)
    }
    col.append(stack, el("span", "svl-col__label", decadeLabel(d)))
    chart.append(col)
  }
  const legend = el("ul", "svl-legend svl-legend--inline")
  for (const f of FAMILIES) {
    const li = el("li")
    li.append(el("span", `svl-swatch svl-fam-${f}`), el("span", "", FAMILY_LABEL[f]))
    legend.append(li)
  }
  root.append(chart, legend)
}

// Horizontal bars per cost band, one group per family.
function costBands(root) {
  for (const f of ["shallow", "wood"]) {
    const rows = view.cost_bands.filter((r) => r.family === f)
    const total = rows.reduce((s, r) => s + r.buildings, 0)
    const max = Math.max(...rows.map((r) => r.buildings))
    const group = el("div", "svl-bands")
    group.append(el("h4", "", FAMILY_LABEL[f]))
    BANDS.forEach((label, band) => {
      const n = (rows.find((r) => r.band === band) || { buildings: 0 }).buildings
      const line = el("div", "svl-band")
      line.append(el("span", "svl-band__label", label))
      const track = el("span", "svl-band__track")
      const bar = el("span", `svl-band__bar svl-fam-${f}`)
      bar.style.width = (100 * n) / max + "%"
      track.append(bar)
      line.append(track, el("span", "svl-band__value", pct(n, total)))
      group.append(line)
    })
    root.append(group)
  }
}

const charts = {
  "family-share": familyShare,
  "risk-table": riskTable,
  "family-risk": familyRisk,
  "decade-risk": decadeRisk,
  "decade-family": decadeFamily,
  "cost-bands": costBands,
}

// Verkennend Funderingsonderzoek per month, last twelve months: counts only.
function verkennendMonths(root) {
  const rows = view.verkennend.months
  const max = Math.max(...rows.map((r) => r.reports))
  const chart = el("div", "svl-columns")
  for (const r of rows) {
    const col = el("div", "svl-col")
    const stack = el("div", "svl-col__stack svl-col__stack--short")
    const seg = el("span", "svl-col__seg svl-vfo")
    seg.style.height = (100 * r.reports) / max + "%"
    const label = new Date(r.month + "-01").toLocaleDateString("nl-NL", { month: "short", year: "2-digit" })
    stack.title = `${label}: ${num(r.reports)}`
    stack.append(seg)
    col.append(stack, el("span", "svl-col__label", label))
    chart.append(col)
  }
  root.append(chart)
}
charts["verkennend-months"] = verkennendMonths

function render() {
  fillFigures()
  document.querySelectorAll("[data-svl-chart]").forEach((root) => {
    // The risk table keeps its head in the HTML; everything else is drawn whole.
    if (root.dataset.svlChart === "risk-table") root.querySelector("tbody")?.replaceChildren()
    else root.replaceChildren()
    charts[root.dataset.svlChart]?.(root)
  })
  document.querySelectorAll("[data-svl-national]").forEach((node) => (node.hidden = !scope))
}

function pick(province) {
  scope = province && data.provinces?.[province] ? province : ""
  view = scope ? { ...data, ...data.provinces[scope] } : data
  render()
}

// The choice lives in the URL (?provincie=Utrecht), so a province view can be shared.
const select = document.getElementById("svl-province")
if (select && data.provinces) {
  for (const name of Object.keys(data.provinces).sort((a, b) => a.localeCompare(b, "nl"))) {
    select.append(new Option(name, name))
  }
  const fromUrl = new URLSearchParams(location.search).get("provincie") || ""
  select.value = data.provinces[fromUrl] ? fromUrl : ""
  select.addEventListener("change", () => {
    const url = new URL(location.href)
    if (select.value) url.searchParams.set("provincie", select.value)
    else url.searchParams.delete("provincie")
    history.replaceState(null, "", url)
    pick(select.value)
  })
  pick(select.value)
} else {
  render()
}
