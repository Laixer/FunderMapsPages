#!/usr/bin/env python3
"""Give a standalone documentation page the site header and footer.

The documentation pages (informatiestandaard*, hoe-het-model-werkt*, begrippen-en-standaarden,
api-documentatie, funderingsrisico-aankoop-verkoop) carry their own inline <style> and were built
without the site chrome. This script, run on such a page in place:

- scopes every rule of the page's <style> under `.doc` (`body` becomes `.doc`), so the page keeps its
  own look and the site header/footer keep theirs;
- loads the site stylesheet and script (needed by the header) before the page style;
- wraps the body in <div class="doc"> between the header and footer partials;
- adds a few resets for what the site base styles and Tailwind preflight change inside `.doc`.

Idempotent: a page that already includes the header partial is left alone. Run it again after
replacing a generated page (informatiestandaard, model page):

    python3 scripts/add-site-chrome.py src/informatiestandaard.html
"""
import re
import sys

COMPAT = """
/* Site chrome (scripts/add-site-chrome.py): undo what the site base styles and preflight change here. */
.doc :is(h1, h2, h3, h4, h5, h6) { color: inherit; font-family: inherit; }
.doc ul { list-style: disc; }
.doc ol { list-style: decimal; }
.doc a { display: inline; }
.doc strong { font-weight: 700; }
.doc code { background: none; padding: 0; border-radius: 0; font-size: inherit; display: inline; }
"""


def scope_selector(sel: str) -> str:
    s = sel.strip()
    if not s:
        return s
    if s.startswith(":root") or s.startswith("@"):
        return s
    if s == "html" or s.startswith("html ") or s.startswith("html:") or s.startswith("html["):
        return s
    if s == "*":
        return ".doc *"
    if s == "body":
        return ".doc"
    if s.startswith("body "):
        return ".doc " + s[5:]
    if s.startswith("body"):  # body.class / body:pseudo
        return ".doc" + s[4:]
    return ".doc " + s


def split_selectors(sel: str):
    out, depth, cur = [], 0, ""
    for ch in sel:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def scope_css(css: str) -> str:
    out, i, n = [], 0, len(css)
    while i < n:
        # copy comments and whitespace
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(css[i:j]); i = j; continue
        if css[i].isspace():
            out.append(css[i]); i += 1; continue
        brace = css.find("{", i)
        if brace < 0:
            out.append(css[i:]); break
        head = css[i:brace]
        # find the matching close brace
        depth, j = 0, brace
        while j < n:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        body = css[brace + 1:j]
        h = head.strip()
        if h.startswith("@media") or h.startswith("@supports"):
            out.append(head + "{" + scope_css(body) + "}")
        elif h.startswith("@"):
            out.append(head + "{" + body + "}")
        else:
            lead = head[: len(head) - len(head.lstrip())]
            sels = ", ".join(scope_selector(x) for x in split_selectors(h))
            out.append(lead + sels + " {" + body + "}")
        i = j + 1
    return "".join(out)


def main(path: str, active: str = "documentatie") -> None:
    html = open(path, encoding="utf-8").read()
    if "_partials/header.html" in html:
        print(f"{path}: already has the site header, skipped")
        return
    m = re.search(r"<style>(.*?)</style>", html, re.S)
    if not m:
        sys.exit(f"{path}: no <style> block")
    scoped = COMPAT + scope_css(m.group(1))
    html = html[: m.start()] + (
        '<link href="./resources/styles/app.scss" rel="stylesheet" />\n'
        '<script src="./resources/scripts/app.js" type="module"></script>\n'
        "<style>" + scoped + "</style>"
    ) + html[m.end():]
    b = re.search(r"<body([^>]*)>", html)
    e = html.rfind("</body>")
    inner = html[b.end():e]
    html = (
        html[: b.start()] + f"<body{b.group(1)}>\n"
        + f"<include src=\"./_partials/header.html\" locals='{{\"active\":\"{active}\"}}'></include>\n"
        + '<div class="doc">' + inner + "</div>\n"
        + '<include src="./_partials/footer.html"></include>\n'
        + html[e:]
    )
    open(path, "w", encoding="utf-8").write(html)
    print(f"{path}: site header and footer added")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
