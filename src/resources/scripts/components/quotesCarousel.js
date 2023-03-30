import Glide from "@glidejs/glide";

export default () => ({
  init() {
    new Glide(this.$refs.glide, {
      type: "carousel",
      perView: 1,
      gap: 30,
      breakpoints: {
        640: {
          gap: 100,
          perView: 1,
        },
        460: {
          perView: 1,
        },
      },
    }).mount();
  },
});
