/*
 * C2V3ZA Tools — GitHub Pages configuration.
 * Public configuration only: NEVER put a GitHub token, password, or client secret here.
 */
window.C2V3ZA_CONFIG = Object.freeze({
  // GitHub repository
  OWNER: "C2V3ZA",
  REPO: "tools",
  BRANCH: "main",

  // Only this GitHub account is allowed to publish/delete tools.
  ADMIN_GITHUB_USERNAME: "C2V3ZA",

  // Public site / API endpoints
  SITE_URL: "https://c2v3za.github.io/tools/",
  GITHUB_API_URL: "https://api.github.com",

  // Repository paths
  TOOLS_INDEX_PATH: "data/tools.json",
  TOOL_UPLOAD_DIR: "assets/tools",
  SCREENSHOT_UPLOAD_DIR: "assets/screenshots",

  // Upload limits
  MAX_TOOL_BYTES: 25 * 1024 * 1024,
  MAX_SCREENSHOT_BYTES: 5 * 1024 * 1024,
  MAX_SCREENSHOTS: 4,

  // GitHub REST API version requested by the admin client.
  API_VERSION: "2026-03-10"
});
