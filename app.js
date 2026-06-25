const sectionThemes = {
  "Situational Awareness": { color: "#007EA7", dark: "#005F82", accent: "#56A0D3", tone: "situation" },
  Operations: { color: "#3F6F2C", dark: "#2E5220", accent: "#8EC06C", tone: "response" },
  Weather: { color: "#007EA7", dark: "#005F82", accent: "#56A0D3", tone: "situation" },
  "Readiness Metric": { color: "#004B79", dark: "#003A5E", accent: "#56A0D3", tone: "readiness" },
  Preparedness: { color: "#004B79", dark: "#003A5E", accent: "#56A0D3", tone: "readiness" },
  "Level 1-2 DAT": { color: "#3F6F2C", dark: "#2E5220", accent: "#8EC06C", tone: "response" },
  "Community Data": { color: "#365A78", dark: "#27445D", accent: "#7DA9C8", tone: "intelligence" },
  "Workforce & Training": { color: "#365A78", dark: "#27445D", accent: "#7DA9C8", tone: "resource" },
  "Trailer Warehouse": { color: "#48606D", dark: "#334752", accent: "#8CA5B2", tone: "logistics" },
  Partnerships: { color: "#48606D", dark: "#334752", accent: "#8CA5B2", tone: "external" }
};

const sectionOrder = [
  "Situational Awareness",
  "Operations",
  "Weather",
  "Readiness Metric",
  "Preparedness",
  "Level 1-2 DAT",
  "Community Data",
  "Workforce & Training",
  "Trailer Warehouse",
  "Partnerships"
];
const dom = {
  sectionGrid: document.querySelector("#sectionGrid"),
  detailView: document.querySelector("#detailView"),
  searchPanel: document.querySelector("#searchPanel"),
  searchInput: document.querySelector("#searchInput"),
  paletteInput: document.querySelector("#paletteInput"),
  searchResults: document.querySelector("#searchResults"),
  searchSummary: document.querySelector("#searchSummary"),
  closeSearch: document.querySelector("#closeSearch"),
  commandForm: document.querySelector("#commandForm"),
  heroStrip: document.querySelector("#sourceFilter"),
  adminOnly: document.querySelectorAll("[data-admin-only]"),
  sourceFilter: document.querySelector("#sourceFilter"),
  helpButton: document.querySelector("#helpButton"),
  helpModal: document.querySelector("#helpModal"),
  closeHelp: document.querySelector("#closeHelp"),
  contactCard: document.querySelector("#contactCard"),
  toast: document.querySelector("#toast")
};

let links = [];
let tocLinks = [];
let navigationReview = null;
let navigationMetadata = {};
let editorRows = [];
let currentReviewCandidates = [];
let activeFilter = "all";
let activeView = "home";
let selectedWeatherId = "";
const desktopSearchPlaceholder = "Search tools, dashboards, pages…";
const mobileSearchPlaceholder = "Search tools, pages…";
const searchExamples = [
  "Operating Picture",
  "Situational Awareness",
  "Shelter",
  "Weather",
  "Power BI",
  "USGS"
];
const editorStorageKey = "florida-ros-navigation-draft";

function normalize(value) {
  return String(value || "").toLowerCase();
}

function isAdminMode() {
  return new URLSearchParams(window.location.search).get("admin") === "1" || ["#/review", "#/edit"].includes(window.location.hash);
}

function syncAdminVisibility() {
  dom.adminOnly.forEach((element) => {
    element.hidden = !isAdminMode();
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Power BI products on the Red Cross side are served from orglerws.redcross.org
// (the RC Power BI gateway) or app.powerbi.com. Detect that signature from the URL
// so a tile is classified Power BI regardless of the hand-typed `kind` field. The
// `kind` field is still honored as a fallback (e.g. ERV, whose stored URL is an
// ArcGIS dashboard but which is operationally a Power BI product).
function decodedTarget(link) {
  const u = link?.url || "";
  if (u.startsWith("/view?u=")) {
    try {
      return decodeURIComponent(new URLSearchParams(u.slice(6)).get("u") || "");
    } catch (e) {
      return u;
    }
  }
  return u;
}

function isPowerBi(link) {
  // Explicit flag: ArcGIS dashboards that EMBED a Power BI report (e.g. ERV) look
  // like any other dashboard by URL, so they must be marked in the data.
  if (link?.powerbi === true) return true;
  const hay = `${decodedTarget(link)} ${link?.host || ""}`.toLowerCase();
  return (
    hay.includes("orgler") ||
    hay.includes("powerbi") ||
    hay.includes("power-bi") ||
    normalize(link?.kind).includes("power bi")
  );
}

function effectiveKind(link) {
  return isPowerBi(link) ? "Power BI" : link?.kind || "";
}

function kindLabel(kind) {
  return kind.replace("Experience Builder page/view", "Experience view").replace("Power BI / Red Cross workspace", "Power BI");
}

function launchLabel(kind) {
  const normalized = normalize(kind);
  if (normalized.includes("experience")) return "Experience";
  if (normalized.includes("power bi")) return "Power BI";
  if (normalized.includes("external")) return "External";
  if (normalized.includes("arcgis")) return "ArcGIS";
  return "Link";
}

function isPlaceholder(item) {
  return Boolean(item?.needsUrl || !item?.url || item.url === "#");
}

function filterMatches(link) {
  if (!link) return false;
  if (activeFilter === "all") return true;
  const kind = normalize(effectiveKind(link));
  if (activeFilter === "experience") return kind.includes("experience");
  if (activeFilter === "arcgis") return kind.includes("arcgis") || kind.includes("story");
  if (activeFilter === "powerbi") return kind.includes("power bi");
  if (activeFilter === "external") return kind.includes("external");
  return true;
}

function searchable(link) {
  return [link.label, link.section, link.kind, link.host, link.page, link.view, link.url].join(" ").toLowerCase();
}

function scoreLink(link, query) {
  const q = normalize(query).trim();
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  const haystack = searchable(link);
  let score = 0;
  for (const term of terms) {
    if (normalize(link.label).includes(term)) score += 8;
    if (normalize(link.section).includes(term)) score += 5;
    if (normalize(link.page).includes(term) || normalize(link.view).includes(term)) score += 4;
    if (haystack.includes(term)) score += 2;
  }
  if (normalize(link.label).startsWith(q)) score += 10;
  return score;
}

// When this launchpad runs embedded (it's the Home page of the master ROS
// Experience Builder), ArcGIS' embed sandbox can block both top-window
// navigation and popups. It also breaks authenticated ArcGIS apps if we add our
// own /view iframe wrapper. Keep launches in the same embedded frame and point
// directly at the decoded destination so the old Experience Builder URL stays
// unchanged without creating iframe-in-iframe OAuth deadlocks.
let isEmbedded = false;
try {
  isEmbedded = window.self !== window.top;
} catch (e) {
  isEmbedded = true; // cross-origin access threw → we are framed
}
const linkTarget = "";

function launchUrl(item) {
  return isEmbedded ? decodedTarget(item) || item.url : item.url;
}

function linkAttrs(item) {
  if (isPlaceholder(item)) {
    return `href="#" data-id="${item.id}" data-placeholder="true" aria-disabled="true" title="${item.label} needs a launch URL"`;
  }
  return `href="${launchUrl(item)}"${linkTarget} rel="noreferrer" data-id="${item.id}" title="${item.label}"`;
}

function weatherDetailItems() {
  const weatherSections = new Set(["Weather"]);
  const relatedWeatherLabels = new Set(["Weather Maps", "NHC View"]);
  return tocLinks.filter((item) => weatherSections.has(item.section) || relatedWeatherLabels.has(item.label));
}

function weatherTabLabel(item) {
  if (item.label === "ARC Hurricane Center") return "Hurricane Center";
  if (item.label === "USGS Flood Inundation") return "USGS Flood";
  return item.label;
}

function weatherTabItems(items) {
  const tabOrder = ["ARC Hurricane Center", "National Weather", "Storm Prediction", "USGS Flood Inundation", "River Gauges"];
  return tabOrder.map((label) => items.find((item) => item.label === label)).filter(Boolean);
}

function weatherSummary(item) {
  const summaries = {
    "ARC Hurricane Center": "Embedded hurricane center view from the Florida regional Weather page.",
    "National Weather": "National weather product surfaced through the Weather page.",
    "Storm Prediction": "Storm prediction view surfaced through the Weather page.",
    "USGS Flood Inundation": "Flood inundation view surfaced through the Weather page.",
    "River Gauges": "River gauge monitoring view surfaced through the Weather page."
  };
  return summaries[item?.label] || "Weather operating product.";
}

function reviewTierLabel(tier) {
  const labels = {
    "promotion-candidate": "Promote",
    "embedded-review": "Embedded review",
    "rename-needed": "Rename needed",
    "draft-review": "Draft link",
    "url-conflict": "URL conflict",
    "source-reference": "Source reference"
  };
  return labels[tier] || "Review";
}

function placeholderJson(candidate) {
  return JSON.stringify(candidate.placeholderTemplate || {}, null, 2);
}

function rowForExport(row, index) {
  const output = {
    order: index + 1,
    section: row.section || "Review Needed",
    label: row.label || "Untitled Product",
    url: row.url || "#",
    kind: row.needsUrl ? "Placeholder" : row.kind || "External web",
    host: row.host || "",
    page: row.page || "",
    view: row.view || "",
    sourceArea: row.sourceArea || "table of contents"
  };
  if (row.needsUrl) output.needsUrl = true;
  if (row.notes) output.notes = row.notes;
  if (row.note) output.note = row.note;
  if (row.powerbi) output.powerbi = true;
  return output;
}

function navigationExportObject() {
  return {
    metadata: {
      ...navigationMetadata,
      exportedAt: new Date().toISOString(),
      note: "Exported from the in-app navigation editor. Replace data/navigation.json after review."
    },
    links: editorRows.map(rowForExport)
  };
}

function navigationExportJson() {
  return `${JSON.stringify(navigationExportObject(), null, 2)}\n`;
}

function applyEditorRowsToApp() {
  links = editorRows.map((item, index) => ({ ...rowForExport(item, index), id: `nav-${index}` }));
  tocLinks = links.filter((item) => item.sourceArea === "table of contents");
  renderSections();
}

function saveEditorDraft() {
  localStorage.setItem(editorStorageKey, navigationExportJson());
  applyEditorRowsToApp();
}

function loadEditorDraft(sourceRows) {
  const saved = localStorage.getItem(editorStorageKey);
  if (!saved) return sourceRows.map((item) => ({ ...item }));
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed.links) ? parsed.links.map((item) => ({ ...item })) : sourceRows.map((item) => ({ ...item }));
  } catch {
    return sourceRows.map((item) => ({ ...item }));
  }
}

function editorSections() {
  return [...new Set([...sectionOrder, ...editorRows.map((row) => row.section).filter(Boolean)])];
}

function editorRowMarkup(row, index) {
  const sectionOptions = editorSections()
    .map((section) => `<option value="${escapeHtml(section)}" ${section === row.section ? "selected" : ""}>${escapeHtml(section)}</option>`)
    .join("");
  return `
    <article class="editor-row" data-editor-row="${index}">
      <label>
        <span>Section</span>
        <select data-editor-field="section">${sectionOptions}</select>
      </label>
      <label>
        <span>Label</span>
        <input data-editor-field="label" value="${escapeHtml(row.label)}" />
      </label>
      <label class="editor-url">
        <span>URL</span>
        <input data-editor-field="url" value="${escapeHtml(row.url)}" />
      </label>
      <label>
        <span>Kind</span>
        <input data-editor-field="kind" value="${escapeHtml(row.kind)}" />
      </label>
      <label class="editor-check">
        <input type="checkbox" data-editor-field="needsUrl" ${row.needsUrl ? "checked" : ""} />
        <span>Needs URL</span>
      </label>
    </article>
  `;
}

function reviewBucketMarkup(title, description, items, limit = 12) {
  if (!items?.length) return "";
  const visibleItems = items.slice(0, limit);
  const remaining = items.length - visibleItems.length;
  return `
    <section class="review-bucket">
      <div class="review-bucket-head">
        <div>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
        <span>${items.length}</span>
      </div>
      <div class="review-list">
        ${visibleItems
          .map((item, index) => {
            const reviewIndex = currentReviewCandidates.push(item) - 1;
            return `
              <article class="review-item">
                <div class="review-item-main">
                  <span class="review-tier">${reviewTierLabel(item.tier)}</span>
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${escapeHtml(item.suggestedSection)} · ${escapeHtml(item.launchSurface || item.host || "Link")}</small>
                </div>
                <p>${escapeHtml(item.reason)}</p>
                <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.host || item.url)}</a>
                <button type="button" data-copy-placeholder="${reviewIndex}">Copy placeholder</button>
              </article>
            `;
          })
          .join("")}
      </div>
      ${remaining ? `<p class="review-more">${remaining} more in <code>data/navigation-review.json</code>.</p>` : ""}
    </section>
  `;
}

function sectionGroups(items) {
  const groups = new Map();
  for (const section of sectionOrder) groups.set(section, []);
  for (const item of items) {
    if (!groups.has(item.section)) groups.set(item.section, []);
    groups.get(item.section).push(item);
  }
  return groups;
}

function renderSections() {
  // Keep every tile in place; dim the ones that don't match the active filter so
  // their positions stay memorable instead of the grid reflowing.
  const groups = sectionGroups(tocLinks);
  dom.sectionGrid.innerHTML = Array.from(groups.entries())
    .filter(([, items]) => items.length)
    .map(([section, items]) => {
      const theme = sectionThemes[section] || { color: "#004B79", dark: "#003A5E", accent: "#56A0D3", tone: "default" };
      return `
        <article class="section-card tone-${theme.tone}" style="--button-color:${theme.color}; --button-dark:${theme.dark}; --accent-color:${theme.accent}">
          <header class="section-head">
            <span>${section}</span>
            ${section === "Weather" ? `<button class="section-open" type="button" data-detail-section="weather" aria-label="Open Weather detail">View</button>` : ""}
          </header>
          <div class="tile-stack">
            ${items
              .map(
                (item) => `
                  <a class="target-tile ${isPlaceholder(item) ? "is-placeholder" : ""} ${activeFilter !== "all" && !filterMatches(item) ? "is-dimmed" : ""}" ${linkAttrs(item)}>
                    <span class="tile-label">${item.label}</span>
                    ${item.note ? `<span class="tile-note">${item.note}</span>` : ""}
                  </a>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
  if (!tocLinks.length) {
    dom.sectionGrid.innerHTML = `<div class="empty-state wide">No targets in the Table of Contents grid.</div>`;
  }
}

function renderWeatherDetail() {
  const items = weatherDetailItems().filter(filterMatches);
  const tabs = weatherTabItems(items);
  const selected = tabs.find((item) => item.id === selectedWeatherId) || tabs[0] || items[0];
  selectedWeatherId = selected?.id || "";
  const rest = items.filter((item) => item.id !== selected?.id);
  dom.detailView.innerHTML = `
    <div class="weather-workspace">
      <div class="weather-pagebar">
        <button class="back-action" type="button" data-back-home>Table of Contents</button>
        <div>
          <p class="detail-kicker">Weather operations</p>
          <h2>${weatherTabLabel(selected)}</h2>
        </div>
        <a class="open-current" ${linkAttrs(selected)}>Open full page</a>
      </div>

      <nav class="weather-tabs" aria-label="Weather products">
        ${tabs
          .map(
            (item) => `
              <button type="button" data-weather-id="${item.id}" aria-pressed="${item.id === selected.id}">
                ${weatherTabLabel(item)}
              </button>
            `
          )
          .join("")}
      </nav>

      <section class="weather-viewer-card">
        <div class="weather-viewer-head">
          <div>
            <strong>${selected.label}</strong>
            <span>${launchLabel(effectiveKind(selected))} · ${selected.host}</span>
          </div>
          <a ${linkAttrs(selected)}>Open in new tab</a>
        </div>
        <div class="weather-frame-shell">
          <div class="weather-frame-fallback" aria-hidden="true">
            <p>Live view loading</p>
            <strong>${weatherTabLabel(selected)}</strong>
            <span>${weatherSummary(selected)}</span>
          </div>
          <iframe class="weather-frame" src="${selected.url}" title="${selected.label}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </section>

      <div class="detail-list">
        ${rest
          .map(
            (item) => `
              <a class="detail-row" ${linkAttrs(item)}>
                <strong>${item.label}</strong>
                <span>${launchLabel(effectiveKind(item))}</span>
                <small>${item.host}</small>
              </a>
            `
          )
          .join("")}
      </div>
    </div>
  `;
  const shell = dom.detailView.querySelector(".weather-frame-shell");
  const frame = dom.detailView.querySelector(".weather-frame");
  const started = Date.now();
  frame?.addEventListener("load", () => {
    const delay = Math.max(0, 1200 - (Date.now() - started));
    window.setTimeout(() => shell?.classList.add("is-loaded"), delay);
  });
}

async function renderReviewDetail() {
  dom.detailView.innerHTML = `
    <div class="review-workspace">
      <div class="detail-top">
        <button class="back-action" type="button" data-back-home>Table of Contents</button>
        <div>
          <p class="detail-kicker">Maintenance</p>
          <h2>Navigation Review</h2>
          <p>Compare the curated launchpad against the latest Assistant JSON extraction. Promote only verified, user-facing products.</p>
        </div>
        <a class="open-current" href="./data/navigation-review.json" target="_blank" rel="noreferrer">Open JSON</a>
      </div>
      <div class="empty-state">Loading review data.</div>
    </div>
  `;

  if (!navigationReview) {
    const response = await fetch("./data/navigation-review.json");
    navigationReview = await response.json();
  }

  const summary = navigationReview.summary || {};
  currentReviewCandidates = [];
  dom.detailView.innerHTML = `
    <div class="review-workspace">
      <div class="detail-top">
        <button class="back-action" type="button" data-back-home>Table of Contents</button>
        <div>
          <p class="detail-kicker">Maintenance</p>
          <h2>Navigation Review</h2>
          <p>Use this to decide what becomes a real launchpad row, what becomes a placeholder, and what stays buried as Experience Builder plumbing.</p>
        </div>
        <a class="open-current" href="./data/navigation-review.json" target="_blank" rel="noreferrer">Open JSON</a>
      </div>

      <section class="review-summary" aria-label="Review summary">
        <span><strong>${summary.curatedRows || 0}</strong> curated rows</span>
        <span><strong>${summary.extractedLinks || 0}</strong> extracted URLs</span>
        <span><strong>${navigationReview.promotionCandidates?.length || 0}</strong> direct candidates</span>
        <span><strong>${navigationReview.embeddedReviewCandidates?.length || 0}</strong> embedded reviews</span>
        <span><strong>${navigationReview.renameNeeded?.length || 0}</strong> rename needed</span>
      </section>

      ${reviewBucketMarkup(
        "Direct Promotion Candidates",
        "Visible Experience Builder button links that are not represented in the curated launchpad yet.",
        navigationReview.promotionCandidates || [],
        12
      )}
      ${reviewBucketMarkup(
        "Embedded Review Candidates",
        "Real embedded URLs that may be useful but need human confirmation before becoming launchpad rows.",
        navigationReview.embeddedReviewCandidates || [],
        12
      )}
      ${reviewBucketMarkup(
        "Rename Needed",
        "Generic widget labels need a real product name before promotion or placeholder creation.",
        navigationReview.renameNeeded || [],
        8
      )}
      ${reviewBucketMarkup(
        "Draft Links",
        "Never promote these until the URL is replaced with a production destination.",
        navigationReview.draftReview || [],
        8
      )}
    </div>
  `;
}

function renderEditorDetail() {
  const tocCount = editorRows.filter((row) => row.sourceArea === "table of contents").length;
  const placeholderCount = editorRows.filter((row) => row.needsUrl).length;
  const hasSavedDraft = Boolean(localStorage.getItem(editorStorageKey));
  dom.detailView.innerHTML = `
    <div class="editor-workspace">
      <div class="detail-top">
        <button class="back-action" type="button" data-back-home>Table of Contents</button>
        <div>
          <p class="detail-kicker">Maintenance</p>
          <h2>Navigation Editor</h2>
          <p>Edit the curated launchpad rows, add placeholders for unresolved products, then copy or download the replacement <code>navigation.json</code>.</p>
        </div>
        <a class="open-current" href="./data/navigation.json" target="_blank" rel="noreferrer">Open source</a>
      </div>

      <section class="editor-toolbar" aria-label="Navigation editor actions">
        <span><strong>${editorRows.length}</strong> rows</span>
        <span><strong>${tocCount}</strong> launchpad rows</span>
        <span><strong>${placeholderCount}</strong> placeholders</span>
        <span><strong>${hasSavedDraft ? "Yes" : "No"}</strong> local draft</span>
        <button type="button" data-add-placeholder>Add placeholder</button>
        <button type="button" data-save-navigation>Save local</button>
        <button type="button" data-reset-navigation>Reset local</button>
        <button type="button" data-copy-navigation>Copy JSON</button>
        <button type="button" data-download-navigation>Download JSON</button>
      </section>

      <section class="editor-panel">
        <div class="editor-head">
          <h3>Curated Navigation Rows</h3>
          <p>Changes here are local until the exported JSON replaces <code>data/navigation.json</code>.</p>
        </div>
        <div class="editor-list">
          ${editorRows.map(editorRowMarkup).join("")}
        </div>
      </section>
    </div>
  `;
}

function setView(view) {
  activeView = view;
  const isWeather = view === "weather";
  const isReview = view === "review";
  const isEditor = view === "editor";
  if ((isWeather || isReview || isEditor) && !dom.searchPanel.hidden) closeSearch();
  dom.heroStrip.hidden = isWeather || isReview || isEditor;
  dom.sectionGrid.hidden = isWeather || isReview || isEditor;
  dom.detailView.hidden = !isWeather && !isReview && !isEditor;
  if (isWeather) renderWeatherDetail();
  if (isReview) renderReviewDetail().catch(() => {
    dom.detailView.innerHTML = `<div class="empty-state">Navigation review data failed to load.</div>`;
  });
  if (isEditor) renderEditorDetail();
}

function syncRoute() {
  syncAdminVisibility();
  if (window.location.hash === "#/weather") {
    setView("weather");
    return;
  }
  if (window.location.hash === "#/review") {
    setView("review");
    return;
  }
  if (window.location.hash === "#/edit") {
    setView("editor");
    return;
  }
  setView("home");
}

function searchMatches(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  return links
    .filter(filterMatches)
    .map((link) => ({ link, score: scoreLink(link, trimmedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.link.label.localeCompare(b.link.label))
    .map((entry) => entry.link);
}

function resultLimit(query) {
  const length = query.trim().length;
  if (length <= 1) return 10;
  if (length <= 3) return 8;
  if (length <= 5) return 6;
  return 5;
}

function resultMarkup(results) {
  return results
    .map(
      (item) => `
        <a class="result-row" ${linkAttrs(item)}>
          <span class="result-section">${item.section}</span>
          <strong>${item.label}</strong>
          <small>${isPlaceholder(item) ? "Needs URL" : kindLabel(effectiveKind(item))}</small>
        </a>
      `
    )
    .join("");
}

function emptySearchMarkup() {
  const chips = searchExamples
    .map((example) => `<button type="button" class="search-chip" data-example="${example}">${example}</button>`)
    .join("");
  return `
    <div class="search-intro">
      <p class="search-intro-title">Try an example</p>
      <div class="search-examples">${chips}</div>
      <ul class="search-intro-tips">
        <li>Search by <strong>product</strong> &mdash; "shelter", "situational awareness"</li>
        <li>Search by <strong>source</strong> &mdash; "Power BI", "ArcGIS", "Experience"</li>
        <li>Search by <strong>web address</strong> &mdash; "usgs", "redcross", "noaa"</li>
        <li>Press <kbd>Enter</kbd> to open the best match.</li>
      </ul>
    </div>
  `;
}

function runSearch(query) {
  const matches = searchMatches(query);
  const best = matches[0];
  const trimmedQuery = query.trim();
  const results = trimmedQuery ? matches.slice(0, resultLimit(trimmedQuery)) : [];
  dom.paletteInput.dataset.bestUrl = best?.url || "";
  dom.paletteInput.dataset.bestLabel = best?.label || "";
  if (!trimmedQuery) {
    dom.searchSummary.textContent = "Type to search, or pick an example below.";
    dom.searchResults.innerHTML = emptySearchMarkup();
    dom.searchPanel.hidden = false;
    return;
  }
  dom.searchSummary.textContent = best ? `${results.length} options. Best match: ${best.label}.` : "No matches. Try a product name, source, or part of a URL.";
  dom.searchResults.innerHTML = resultMarkup(results);
  dom.searchPanel.hidden = false;
}

function openBestSearchMatch() {
  const matches = searchMatches(dom.paletteInput.value);
  const best = matches[0];
  if (!best) {
    showToast("No matching operating product");
    return;
  }
  if (isPlaceholder(best)) {
    showToast(`${best.label} needs a launch URL`);
    return;
  }
  showToast(`Opening ${best.label}`);
  window.location.assign(best.url);
}

function openSearch(query = dom.searchInput.value) {
  dom.paletteInput.value = query;
  runSearch(query);
  requestAnimationFrame(() => {
    dom.paletteInput.focus();
    dom.paletteInput.select();
  });
}

function closeSearch() {
  dom.searchPanel.hidden = true;
  dom.paletteInput.value = "";
  dom.searchInput.value = "";
}

function openHelp(focusTarget = "") {
  syncAdminVisibility();
  dom.helpModal.dataset.focus = focusTarget;
  dom.helpModal.hidden = false;
  requestAnimationFrame(() => {
    if (focusTarget === "contact") dom.contactCard.scrollIntoView({ block: "nearest" });
    dom.closeHelp.focus();
  });
}

function closeHelp() {
  dom.helpModal.hidden = true;
  dom.helpModal.dataset.focus = "";
}

function syncResponsiveCopy() {
  const isCompact = window.matchMedia("(max-width: 520px)").matches;
  dom.searchInput.placeholder = isCompact ? mobileSearchPlaceholder : desktopSearchPlaceholder;
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => dom.toast.classList.remove("show"), 1600);
}

async function boot() {
  const response = await fetch("./data/navigation.json");
  const data = await response.json();
  navigationMetadata = data.metadata || {};
  editorRows = loadEditorDraft(data.links);
  applyEditorRowsToApp();
  syncRoute();
}

dom.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  openSearch(dom.searchInput.value);
});
dom.sourceFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  dom.sourceFilter.querySelectorAll("[data-filter]").forEach((filterButton) => {
    filterButton.setAttribute("aria-pressed", String(filterButton === button));
  });
  renderSections();
  if (activeView === "weather") renderWeatherDetail();
  if (!dom.searchPanel.hidden) runSearch(dom.paletteInput.value);
});
dom.searchInput.addEventListener("focus", () => openSearch(dom.searchInput.value));
dom.searchInput.addEventListener("click", () => openSearch(dom.searchInput.value));
dom.searchInput.addEventListener("input", () => openSearch(dom.searchInput.value));
dom.paletteInput.addEventListener("input", () => {
  dom.searchInput.value = dom.paletteInput.value;
  runSearch(dom.paletteInput.value);
});
dom.paletteInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  openBestSearchMatch();
});
dom.closeSearch.addEventListener("click", closeSearch);
dom.searchResults.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-example]");
  if (!chip) return;
  event.preventDefault();
  dom.paletteInput.value = chip.dataset.example;
  dom.searchInput.value = chip.dataset.example;
  runSearch(chip.dataset.example);
  dom.paletteInput.focus();
});
dom.helpButton.addEventListener("click", () => openHelp());
document.querySelector("#contactButton")?.addEventListener("click", () => {
  // mailto still fires for users with a mail client; copy + toast guarantees
  // feedback when no handler is set or the app is embedded in an iframe.
  navigator.clipboard?.writeText("FloridaSads@RedCross.org");
  showToast("Email copied: FloridaSads@RedCross.org");
});
dom.closeHelp.addEventListener("click", closeHelp);
dom.helpModal.addEventListener("click", (event) => {
  if (event.target === dom.helpModal) closeHelp();
});
dom.searchPanel.addEventListener("click", (event) => {
  if (event.target === dom.searchPanel) closeSearch();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && ![dom.searchInput, dom.paletteInput].includes(document.activeElement)) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    closeSearch();
    closeHelp();
  }
});
document.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-detail-section]");
  if (detailButton?.dataset.detailSection === "weather") {
    window.location.hash = "#/weather";
    return;
  }
  if (event.target.closest("[data-back-home]")) {
    window.location.hash = "#/";
    return;
  }
  const weatherTab = event.target.closest("[data-weather-id]");
  if (weatherTab) {
    selectedWeatherId = weatherTab.dataset.weatherId;
    renderWeatherDetail();
    return;
  }
  if (event.target.closest("[data-open-review]")) {
    closeHelp();
    window.location.hash = "#/review";
    return;
  }
  if (event.target.closest("[data-open-editor]")) {
    closeHelp();
    window.location.hash = "#/edit";
    return;
  }
  const placeholderButton = event.target.closest("[data-copy-placeholder]");
  if (placeholderButton) {
    const candidate = currentReviewCandidates[Number(placeholderButton.dataset.copyPlaceholder)];
    navigator.clipboard?.writeText(placeholderJson(candidate));
    showToast(`Copied placeholder for ${candidate.label}`);
    return;
  }
  if (event.target.closest("[data-add-placeholder]")) {
    editorRows.push({
      order: editorRows.length + 1,
      section: "Review Needed",
      label: "New Placeholder Product",
      url: "#",
      needsUrl: true,
      kind: "Placeholder",
      host: "",
      page: "",
      view: "",
      sourceArea: "table of contents",
      notes: "Add verified launch URL."
    });
    renderEditorDetail();
    showToast("Added placeholder row");
    return;
  }
  if (event.target.closest("[data-save-navigation]")) {
    saveEditorDraft();
    renderEditorDetail();
    showToast("Saved local navigation draft");
    return;
  }
  if (event.target.closest("[data-reset-navigation]")) {
    localStorage.removeItem(editorStorageKey);
    window.location.reload();
    return;
  }
  if (event.target.closest("[data-copy-navigation]")) {
    navigator.clipboard?.writeText(navigationExportJson());
    showToast("Copied navigation JSON");
    return;
  }
  if (event.target.closest("[data-download-navigation]")) {
    const blob = new Blob([navigationExportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "navigation.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded navigation JSON");
    return;
  }
  const launch = event.target.closest("a[data-id]");
  if (launch?.dataset.placeholder === "true") {
    event.preventDefault();
    showToast(`${launch.title.replace(" needs a launch URL", "")} needs a launch URL`);
    return;
  }
  if (launch) showToast(`Opening ${launch.title}`);
});
document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-editor-field]");
  if (!field) return;
  const rowElement = field.closest("[data-editor-row]");
  const row = editorRows[Number(rowElement?.dataset.editorRow)];
  if (!row) return;
  const key = field.dataset.editorField;
  row[key] = field.type === "checkbox" ? field.checked : field.value;
  if (key === "url" && field.value && field.value !== "#") row.needsUrl = false;
});
window.addEventListener("resize", syncResponsiveCopy);
window.addEventListener("hashchange", syncRoute);

boot().catch((error) => {
  console.error(error);
  dom.sectionGrid.innerHTML = '<div class="empty-state">Navigation data failed to load.</div>';
});
syncResponsiveCopy();
