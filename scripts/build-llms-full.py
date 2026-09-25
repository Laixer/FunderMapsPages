#!/usr/bin/env python3
"""Regenerate src/llms-full.txt from the built pages in dist/ (run `pnpm build` first).

One section per page, headings and body text only, so the text AI search
engines read stays in step with the site. Run it whenever page copy changes.
"""
import html, re, pathlib

PAGES = [
    ("Home", "index.html", ""),
    ("Stand van het Land", "stand-van-het-land.html", "stand-van-het-land.html"),
    ("Hoe FunderMaps het funderingsrisico bepaalt", "hoe-het-model-werkt.html", "hoe-het-model-werkt.html"),
    ("Informatiestandaard funderingsgegevens", "informatiestandaard.html", "informatiestandaard.html"),
    ("Begrippen, standaarden en catalogus", "begrippen-en-standaarden.html", "begrippen-en-standaarden.html"),
    ("Kennisbank", "kennisbank.html", "kennisbank.html"),
    ("FunderMaps API v4", "api-documentatie.html", "api-documentatie.html"),
    ("Nationaal Herstel Register", "nationaal-herstelregister.html", "nationaal-herstelregister.html"),
    ("Funderingstypen en -risico's", "media-library.html", "media-library.html"),
    ("Artikelen", "artikelen.html", "artikelen.html"),
    ("Dataverwerking funderingsdata", "dataverwerking.html", "dataverwerking.html"),
    ("Disclaimer", "disclaimer.html", "disclaimer.html"),
]
DIST = pathlib.Path(__file__).resolve().parent.parent / "dist"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "llms-full.txt"


def text_of(page: str) -> str:
    t = (DIST / page).read_text(encoding="utf-8")
    m = re.search(r"<main[^>]*>(.*)</main>", t, re.S)
    t = m.group(1) if m else t
    t = re.sub(r"<(script|style|svg|nav|footer|details)[^>]*>.*?</\1>", "", t, flags=re.S)
    t = re.sub(r"<h([1-4])[^>]*>(.*?)</h\1>", lambda m: "\n\n" + "#" * (int(m.group(1)) + 1) + " " + re.sub(r"<[^>]+>", "", m.group(2)).strip() + "\n\n", t, flags=re.S)
    t = re.sub(r"<li[^>]*>", "\n- ", t)
    t = re.sub(r"</(p|div|tr|li|ul|ol|table|section|article)>", "\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


parts = ["# FunderMaps — full content\n\n> This file is the consolidated textual content of fundermaps.com (the Dutch site). One section per page. Use it as long-form context for FunderMaps; for a structured index, see llms.txt.\n"]
for title, page, slug in PAGES:
    parts.append(f"\n---\n\n# {title}\n\nURL: https://fundermaps.com/{slug}\n\n{text_of(page)}\n")
OUT.write_text("".join(parts), encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
