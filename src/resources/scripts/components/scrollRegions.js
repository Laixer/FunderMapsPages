// A box that scrolls sideways (a code example, a wide table) must be reachable
// by keyboard, or the part outside the box stays out of reach. Only boxes that
// actually overflow get a tab stop, so a wide window adds none.
const SELECTOR = "pre, .svl-scroll, .svl-columns, main .overflow-x-auto"
// A box with a link or a control inside is reachable through that already.
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]"

export default function scrollRegions() {
  const mark = () => {
    for (const box of document.querySelectorAll(SELECTOR)) {
      const ours = box.getAttribute("role") === "region"
      if (!ours && box.querySelector(FOCUSABLE)) continue
      if (box.scrollWidth > box.clientWidth + 1) {
        box.tabIndex = 0
        box.setAttribute("role", "region")
        box.setAttribute("aria-label", box.tagName === "PRE" ? "Codevoorbeeld, schuift opzij" : "Tabel, schuift opzij")
      } else if (ours) {
        box.removeAttribute("tabindex")
        box.removeAttribute("role")
        box.removeAttribute("aria-label")
      }
    }
  }

  // At most once per frame, however often the page changes.
  let queued = false
  const later = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      mark()
    })
  }

  mark()
  window.addEventListener("resize", later)
  // Stand van het Land draws its tables after load; look again once they are in.
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true })
}
