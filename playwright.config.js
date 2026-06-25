module.exports = {
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:8735",
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: "python3 -m http.server 8735 --bind 127.0.0.1",
    url: "http://127.0.0.1:8735",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe"
  }
};
