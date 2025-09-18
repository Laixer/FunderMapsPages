import Glide from "@glidejs/glide";

export default () => ({
  glide: null,
  currentIndex: 0,
  menuTriggers: [],
  slidesEl: null,
  resizeHandler: null,

  init() {
    this.menuTriggers = Array.from(document.querySelectorAll('[data-article-target]'));
    this.slidesEl = this.$refs.glide.querySelector('.glide__slides');

    if (this.slidesEl) {
      this.slidesEl.style.transition = 'height 300ms ease';
    }

    this.glide = new Glide(this.$refs.glide, {
      type: 'carousel',
      perView: 1,
      gap: 24,
      animationDuration: 550,
    });

    this.glide.on('mount.after', () => {
      this.currentIndex = this.glide.index;
      this.updateMenuState();
      this.updateHeight();
    });

    this.glide.on('run.after', () => {
      this.currentIndex = this.glide.index;
      this.updateMenuState();
      this.updateHeight();
    });

    this.glide.mount();

    this.menuTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const index = Number(trigger.dataset.articleTarget || 0);
        this.goTo(index);
      });
    });

    this.resizeHandler = () => this.updateHeight();
    window.addEventListener('resize', this.resizeHandler);

    this.updateMenuState();
    this.updateHeight();
  },

  destroy() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  },

  goTo(index) {
    if (Number.isNaN(index)) return;
    this.currentIndex = index;
    this.glide.go(`=${index}`);
    this.updateMenuState();
    this.updateHeight();
    this.$root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  updateMenuState() {
    this.menuTriggers.forEach((trigger, idx) => {
      if (idx === this.currentIndex) {
        trigger.setAttribute('aria-current', 'true');
      } else {
        trigger.removeAttribute('aria-current');
      }
    });
  },

  updateHeight() {
    if (!this.slidesEl) return;
    const activeSlide = this.slidesEl.querySelector('.glide__slide--active');
    if (!activeSlide) return;

    requestAnimationFrame(() => {
      const targetHeight = activeSlide.scrollHeight;
      this.slidesEl.style.height = `${targetHeight}px`;
    });
  },

  cardClasses(index) {
    return this.currentIndex === index
      ? 'border-yellow-400 bg-yellow-50 shadow-lg ring-2 ring-yellow-300'
      : '';
  },
});
