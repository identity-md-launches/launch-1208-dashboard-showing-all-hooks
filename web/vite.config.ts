export default {
  base: "./",
  build: {
    outDir: process.env.HOOKBOOK_OUTPUT || "../dist",
    emptyOutDir: true,
  },
};
