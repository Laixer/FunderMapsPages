import Glide from "@glidejs/glide";

export default () => ({
  init() {
    new Glide(this.$refs.glide, {
      type: "carousel",
      perView: 4.5,
      gap: 15,
      breakpoints: {
        1200: {
          perView: 3.5,
        },
        882: {
          perView: 2.5,
        },
        578: {
          perView: 1.5,
        },
      },
    }).mount();
  },
});
