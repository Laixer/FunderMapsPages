// Import Alpine, Alpine Components and Alpine Plugins
import Alpine from 'alpinejs'
import ui from '@alpinejs/ui'
import collapse from '@alpinejs/collapse'
import focus from '@alpinejs/focus'

// Import Comnponent specific JS
import mobileMenu from './components/mobileMenu.js'
import referencesCarousel from './components/referencesCarousel.js'
import quotesCarousel from './components/quotesCarousel.js'

(async () => {
  // Make alpine easier to use from the DevTools
  window.Alpine = Alpine

  // AlpineJS Components: Headless UI
  // https://alpinejs.dev/components
  Alpine.plugin(ui)

  // AlpineJS PLugin: Collapse for smooth animations
  Alpine.plugin(collapse)
  Alpine.plugin(focus)

  // Alpine Data
  // https://alpinejs.dev/globals/alpine-data
  Alpine.data('mobileMenu', mobileMenu)
  Alpine.data("references_carousel", referencesCarousel);
  Alpine.data("quotes_carousel", quotesCarousel);

  Alpine.start()
})();
