export default {
  server: {
    port: 5500,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
};
