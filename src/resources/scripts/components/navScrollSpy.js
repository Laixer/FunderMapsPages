// Scroll-spy: keep the header's active nav item in sync with the section
// currently in view. Updates `data-active-nav` on the header, which the
// existing `_menu.scss` active-state rules already key off.
//
// A thin trigger line at ~30% from the top means exactly one section is
// "current" at a time; gaps between sections keep the last active item.
export default function navScrollSpy() {
  const header = document.querySelector("header[data-active-nav]")
  if (!header) return

  // section id -> nav data-nav-key
  const map = {
    hero: "intro",
    services: "services",
    preview: "demo",
    references: "references",
    partners: "partners",
  }

  const sections = Object.keys(map)
    .map((id) => document.getElementById(id))
    .filter(Boolean)

  // Only the home page has these in-page sections; bail elsewhere so the
  // static per-page `data-active-nav` is left untouched.
  if (sections.length < 2) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          header.setAttribute("data-active-nav", map[entry.target.id])
        }
      })
    },
    { rootMargin: "-30% 0px -70% 0px", threshold: 0 },
  )

  sections.forEach((section) => observer.observe(section))
}
