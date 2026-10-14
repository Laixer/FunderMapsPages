#!/usr/bin/env python3
"""Regenerate src/llms-full.txt from the built pages in dist/ (run `pnpm build` first).

One section per page, headings and body text only, so the text AI search
engines read stays in step with the site. Run it whenever page copy changes.
"""
import html, re, pathlib
from html.parser import HTMLParser

PAGES = [
    ("Home", "index.html", ""),
    ("Stand van het land", "stand-van-het-land.html", "stand-van-het-land.html"),
    ("Hoe FunderMaps het funderingsrisico bepaalt", "hoe-het-model-werkt.html", "hoe-het-model-werkt.html"),
    ("Informatiestandaard funderingsgegevens", "informatiestandaard.html", "informatiestandaard.html"),
    ("Begrippen, standaarden en catalogus", "begrippen-en-standaarden.html", "begrippen-en-standaarden.html"),
    ("Kennisbank", "kennisbank.html", "kennisbank.html"),
    ("FunderMaps API", "api.html", "api.html"),
    ("FunderMaps API v4", "api-documentatie.html", "api-documentatie.html"),
    ("Nationaal Herstel Register", "nationaal-herstelregister.html", "nationaal-herstelregister.html"),
    ("Funderingstypen en -risico's", "media-library.html", "media-library.html"),
    ("Artikelen", "artikelen.html", "artikelen.html"),
    ("Dataverwerking funderingsdata", "dataverwerking.html", "dataverwerking.html"),
    ("Disclaimer", "disclaimer.html", "disclaimer.html"),
]
DIST = pathlib.Path(__file__).resolve().parent.parent / "dist"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "llms-full.txt"


# The attributes of a tag; a quoted value may hold a ">" (data-glide-dir=">").
ATTRS = r"""(?:[^>"']|"[^"]*"|'[^']*')*"""
TAG = "<" + ATTRS + ">"
# The build writes an attribute value bare when it can (alt=Aalsmeer).
ALT = r"""\salt=(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))"""
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
# Stand van het land fills its figures in the browser; the built page holds only "–" in their place.
LIVE_FIGURES = "De actuele cijfers staan op de pagina Stand van het land: https://fundermaps.com/stand-van-het-land.html"


class Cuts(HTMLParser):
    """Finds what is not text a visitor reads: elements with the `hidden` attribute, and the blocks that
    show a figure the browser fills in (`data-svl`, other than the scope name, and `data-svl-chart`)."""

    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src, self.stack, self.found = src, [], []
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", src)]
        self.feed(src)
        self.close()

    def here(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("data-svl", "scope") != "scope":
            for e in self.stack:
                e["live"] = e["live"] or e["block"]
        if tag in VOID:
            return
        block = tag == "p" or "svl-figure" in (a.get("class") or "").split()
        self.stack.append({"tag": tag, "start": self.here(), "hidden": "hidden" in a, "live": "data-svl-chart" in a, "block": block})

    def handle_endtag(self, tag):
        if not any(e["tag"] == tag for e in self.stack):
            return
        while (e := self.stack.pop())["tag"] != tag:
            pass
        if e["hidden"] or e["live"]:
            self.found.append((e["start"], self.src.index(">", self.here()) + 1, "live" if e["live"] and not e["hidden"] else "hidden"))

    def apply(self):
        out, at, noted = [], 0, False
        for start, end, kind in sorted(self.found):
            if start < at:
                continue  # inside a stretch already cut
            out.append(self.src[at:start])
            if kind == "live" and not noted:
                out.append(f"<p>{LIVE_FIGURES}</p>")
                noted = True
            at = end
        return "".join(out) + self.src[at:]


def alt_of(attrs: str) -> str:
    m = re.search(ALT, attrs)
    return next((v for v in m.groups() if v is not None), "") if m else ""


def text_of(page: str) -> str:
    t = (DIST / page).read_text(encoding="utf-8")
    m = re.search(r"<main[^>]*>(.*)</main>", t, re.S)
    t = m.group(1) if m else t
    t = Cuts(t).apply()
    t = re.sub(r"<(script|style|svg|nav|footer|details)\b" + ATTRS + r">.*?</\1>", "", t, flags=re.S)
    t = re.sub(r"<h([1-4])\b" + ATTRS + r">(.*?)</h\1>", lambda m: "\n\n" + "#" * (int(m.group(1)) + 1) + " " + re.sub(TAG, "", m.group(2)).strip() + "\n\n", t, flags=re.S)
    # A list item that holds only a picture (the logo strips) stands for the picture's text: the organisation's name.
    t = re.sub(r"(<li\b" + ATTRS + r">)\s*<img\b(" + ATTRS + r")>\s*(?=</li>)", lambda m: m.group(1) + alt_of(m.group(2)), t)
    t = re.sub(r"<li\b" + ATTRS + ">", "\n- ", t)
    t = re.sub(r"</(p|div|tr|li|ul|ol|table|section|article)>", "\n", t)
    # A line-break hint inside a word or an address is not a space.
    t = re.sub(r"<wbr\b" + ATTRS + ">", "", t)
    # Any other tag is a word boundary, except against punctuation: "Register</a>," reads "Register,"
    # and "(<code>id</code>)" reads "(id)". Spaces written in the text itself stay.
    t = re.sub(TAG, "\0", t)
    t = re.sub(r"\0+(?=[,.;:)])", "", t)
    t = re.sub(r"(?<=\()\0+", "", t)
    t = t.replace("\0", " ")
    t = html.unescape(t)
    # A soft hyphen only tells a browser where a long word may break; it is not part of the text.
    t = t.replace("\u00ad", "")
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    # A list item left empty (a picture without a text) is not a bullet.
    t = re.sub(r"^-\n", "", t, flags=re.M)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


parts = ["# FunderMaps — full content\n\n> This file is the consolidated textual content of fundermaps.com (the Dutch site). One section per page. Use it as long-form context for FunderMaps; for a structured index, see llms.txt.\n"]
for title, page, slug in PAGES:
    parts.append(f"\n---\n\n# {title}\n\nURL: https://fundermaps.com/{slug}\n\n{text_of(page)}\n")
OUT.write_text("".join(parts), encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
