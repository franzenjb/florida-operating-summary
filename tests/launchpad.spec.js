const { execFileSync } = require("node:child_process");
const path = require("node:path");

function loadPlaywrightTest() {
  try {
    return require("@playwright/test");
  } catch (error) {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    return require(path.join(globalRoot, "@playwright/test"));
  }
}

const { test, expect } = loadPlaywrightTest();

test("launchpad loads, searches, and filters Power BI tiles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".target-tile")).toHaveCount(43);

  await page.locator("#searchInput").click();
  await expect(page.locator("#searchPanel")).toBeVisible();
  await page.locator("#paletteInput").fill("door");
  await expect(page.locator("#searchSummary")).toContainText("Best match: DOOR");
  await expect(page.locator(".result-row")).toContainText(["DOOR"]);

  await page.keyboard.press("Escape");
  await page.locator('[data-filter="powerbi"]').click();
  await expect(page.locator('[data-filter="powerbi"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".target-tile:not(.is-dimmed)")).toHaveCount(20);
  await expect(page.locator(".target-tile.is-dimmed")).toHaveCount(23);
});

test("embedded launchpad opens targets inside the sandboxed frame", async ({ page, baseURL }) => {
  await page.setContent(`
    <!doctype html>
    <iframe
      id="embed"
      sandbox="allow-scripts allow-same-origin"
      src="${baseURL}/"
      style="width: 1200px; height: 700px; border: 0"
    ></iframe>
  `);

  const frame = page.frameLocator("#embed");
  await expect(frame.locator(".target-tile")).toHaveCount(43);

  const readiness = frame.locator('a[title="National Readiness"]');
  await expect(readiness).not.toHaveAttribute("target", /.+/);
  await expect(readiness).toHaveAttribute("href", /\/view\?u=/);

  await readiness.click();
  await expect
    .poll(() => page.frames().some((item) => item.url().includes("/view?u=")))
    .toBe(true);
});
