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

test("embedded launchpad keeps holder links", async ({ page, baseURL }) => {
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

  const nhc = frame.locator('a[title="NHC View"]');
  await expect(nhc).not.toHaveAttribute("target", /.+/);
  await expect(nhc).toHaveAttribute("href", /\/view\?u=/);
});

test("embedded holder shows the red return bar for ArcGIS auth targets", async ({ page, baseURL }) => {
  const holderUrl = `${baseURL}/view.html?u=${encodeURIComponent(
    "https://arc-nhq-gis.maps.arcgis.com/apps/dashboards/ccc84af4f5374f46b0734a394fd181f1"
  )}&t=National%20Readiness`;

  await page.setContent(`
    <!doctype html>
    <iframe
      id="holder"
      sandbox="allow-scripts allow-same-origin"
      src="${holderUrl}"
      style="width: 1200px; height: 700px; border: 0"
    ></iframe>
  `);

  const holder = page.frameLocator("#holder");
  await expect(holder.locator("#back")).toContainText("Back to Florida ROS");
  await expect(holder.locator("#title")).toHaveText("National Readiness");
  await expect(holder.locator("#err")).toHaveClass(/show/);
  await expect(holder.locator("#frame")).toHaveCSS("display", "none");
  await expect(holder.locator("#errlink")).toContainText("Open in this space");
  await expect(holder.locator("#errlink")).not.toHaveAttribute("target", /.+/);
});
