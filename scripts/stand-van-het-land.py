#!/usr/bin/env python3
"""Write src/data/stand-van-het-land.json: the country plus one block per province.

Runs scripts/stand-van-het-land.sql (read-only) once for the whole country
and once per province (Don, 2026-10-08: "naast heel NL de grafieken en
tabellen, diezelfde opmaak per provincie"). The national document stays the
top level, so the page works as before; `provinces` holds, per province, the
pand figures the page redraws when a province is picked.

    DATABASE_URL=postgres://... python3 scripts/stand-van-het-land.py
"""
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQL = ROOT / "scripts" / "stand-van-het-land.sql"
OUT = ROOT / "src" / "data" / "stand-van-het-land.json"
PROVINCES = ["Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg", "Noord-Brabant",
             "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland"]
# What follows the province; the rest is national only.
PER_PROVINCE = ["coverage", "families", "risk_table", "family_risk", "decade_risk", "decade_family", "costs", "cost_bands"]


def run(province: str) -> dict:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")
    out = subprocess.run(
        ["psql", url, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", f"province={province}", "-f", str(SQL)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return json.loads(out)


def main():
    doc = run("")
    doc["provinces"] = {}
    for p in PROVINCES:
        part = run(p)
        doc["provinces"][p] = {k: part[k] for k in PER_PROVINCE}
        print(f"{p}: {part['coverage']['buildings']} panden", file=sys.stderr)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} kB)", file=sys.stderr)


if __name__ == "__main__":
    main()
