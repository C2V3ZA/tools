(() => {
  "use strict";

  const CONFIG = window.C2V3ZA_CONFIG;
  const TEXT = {
    en: {
      "nav.tools": "Tools", "nav.about": "About", "language.label": "Language",
      "hero.eyebrow": "PRIVATE TOOL COLLECTION", "hero.lead": "A focused home for private tools, utilities and experiments — published from one clean collection.",
      "hero.browse": "Browse collection", "hero.github": "Open GitHub ↗",
      "trust.static": "Static", "trust.pages": "GitHub Pages", "trust.private": "Private admin",
      "terminal.loaded": "tools loaded", "terminal.media": "screenshots indexed", "terminal.language": "language auto-detected", "terminal.deploy": "deployment ready", "terminal.repository": "repository", "terminal.branch": "branch",
      "tools.kicker": "COLLECTION", "tools.title": "Available tools", "tools.subtitle": "Search the published collection.", "tools.searchLabel": "Search tools", "tools.search": "Search tools...",
      "empty.title": "No tools published yet", "empty.text": "The collection is ready. Publish a tool from the separate local admin panel and it will appear here automatically.",
      "empty.searchTitle": "No matching tools", "empty.searchText": "Try a different search term.",
      "error.title": "Collection unavailable", "error.text": "The public site could not read its tool index. Check the GitHub Pages deployment.",
      "about.kicker": "ABOUT", "about.title": "Built to stay simple.", "about.text": "C2V3ZA Tools is a static GitHub Pages front end. The publishing admin stays on your own machine, so no admin interface or long-lived write credential is shipped to the public site.", "about.platform": "Platform", "about.repository": "Repository", "about.language": "Language", "about.status": "Status", "about.online": "Online",
      "footer.text": "Built for GitHub Pages · private publishing workflow", "download": "Download tool", "open": "View details"
    },
    de: {
      "nav.tools": "Tools", "nav.about": "Über uns", "language.label": "Sprache",
      "hero.eyebrow": "PRIVATE TOOL-SAMMLUNG", "hero.lead": "Ein fokussierter Ort für private Tools, Hilfsprogramme und Experimente — veröffentlicht aus einer sauberen Sammlung.",
      "hero.browse": "Sammlung öffnen", "hero.github": "GitHub öffnen ↗",
      "trust.static": "Statisch", "trust.pages": "GitHub Pages", "trust.private": "Privates Admin",
      "terminal.loaded": "Tools geladen", "terminal.media": "Screenshots indexiert", "terminal.language": "Sprache automatisch erkannt", "terminal.deploy": "Deployment bereit", "terminal.repository": "Repository", "terminal.branch": "Branch",
      "tools.kicker": "SAMMLUNG", "tools.title": "Verfügbare Tools", "tools.subtitle": "Durchsuche die veröffentlichte Sammlung.", "tools.searchLabel": "Tools suchen", "tools.search": "Tools suchen...",
      "empty.title": "Noch keine Tools veröffentlicht", "empty.text": "Die Sammlung ist bereit. Veröffentliche ein Tool über das separate lokale Admin-Panel, dann erscheint es automatisch hier.",
      "empty.searchTitle": "Keine passenden Tools", "empty.searchText": "Versuche einen anderen Suchbegriff.",
      "error.title": "Sammlung nicht verfügbar", "error.text": "Die Website konnte den Tool-Index nicht laden. Prüfe das GitHub-Pages-Deployment.",
      "about.kicker": "ÜBER C2V3ZA", "about.title": "Bewusst einfach gebaut.", "about.text": "C2V3ZA Tools ist ein statisches GitHub-Pages-Frontend. Das Publishing-Admin bleibt auf deinem eigenen Rechner, sodass weder Admin-Oberfläche noch dauerhafte Schreibzugänge auf der öffentlichen Website landen.", "about.platform": "Plattform", "about.repository": "Repository", "about.language": "Sprache", "about.status": "Status", "about.online": "Online",
      "footer.text": "Für GitHub Pages gebaut · privater Publishing-Workflow", "download": "Tool herunterladen", "open": "Details ansehen"
    }
  };

  const state = { lang: CONFIG.defaultLanguage, tools: [], query: "", galleryIndex: 0, galleryTool: null };
  const $ = (id) => document.getElementById(id);
  const supported = new Set(CONFIG.languages);

  function text(key) { return TEXT[state.lang]?.[key] ?? TEXT[CONFIG.defaultLanguage]?.[key] ?? key; }

  function detectLanguage() {
    try {
      const saved = localStorage.getItem(CONFIG.languageStorageKey);
      if (supported.has(saved)) return saved;
    } catch {}
    const langs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const candidate of langs) {
      const base = String(candidate).toLowerCase().split("-")[0];
      if (supported.has(base)) return base;
    }
    return CONFIG.defaultLanguage;
  }

  function applyLanguage(lang) {
    state.lang = supported.has(lang) ? lang : CONFIG.defaultLanguage;
    try { localStorage.setItem(CONFIG.languageStorageKey, state.lang); } catch {}
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = text(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => { node.setAttribute("placeholder", text(node.dataset.i18nPlaceholder)); });
    $("languageSelect").value = state.lang;
    $("languageStatus").textContent = state.lang.toUpperCase();
    render();
  }

  function chooseLocalized(tool, field) {
    const value = tool?.[field];
    if (value && typeof value === "object") return String(value[state.lang] ?? value[CONFIG.defaultLanguage] ?? Object.values(value)[0] ?? "");
    return String(tool?.[`${field}_${state.lang}`] ?? tool?.[`${field}_${CONFIG.defaultLanguage}`] ?? tool?.[field] ?? "");
  }

  function safePublicPath(value, prefix) {
    if (typeof value !== "string" || !value || value.includes("\\") || value.includes("..") || value.startsWith("/") || !value.startsWith(prefix)) return null;
    return `./${value}`;
  }

  function normalizeTool(raw) {
    if (!raw || typeof raw !== "object") return null;
    const slug = String(raw.slug || "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    const screenshots = Array.isArray(raw.screenshots) ? raw.screenshots.map((x) => safePublicPath(x, "assets/screenshots/")).filter(Boolean) : [];
    const download = safePublicPath(raw.download, "downloads/");
    if (!download) return null;
    return { ...raw, slug, screenshots, download };
  }

  function makeToolCard(tool) {
    const card = document.createElement("article");
    card.className = "tool-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    const name = chooseLocalized(tool, "name") || tool.slug;
    const description = chooseLocalized(tool, "description");
    const media = document.createElement("div");
    media.className = "tool-media";
    if (tool.screenshots[0]) {
      const img = document.createElement("img");
      img.loading = "lazy"; img.decoding = "async"; img.src = tool.screenshots[0]; img.alt = `${name} screenshot`;
      img.addEventListener("error", () => { media.replaceChildren(); const fallback = document.createElement("div"); fallback.className = "tool-no-image"; fallback.textContent = "+"; media.appendChild(fallback); }, { once: true });
      media.appendChild(img);
    } else {
      const fallback = document.createElement("div"); fallback.className = "tool-no-image"; fallback.textContent = "+"; media.appendChild(fallback);
    }
    if (tool.screenshots.length > 0) {
      const badge = document.createElement("span"); badge.className = "tool-overlay"; badge.textContent = `${tool.screenshots.length} ${state.lang === "de" ? "Screenshots" : "Screenshots"}`; media.appendChild(badge);
    }

    const body = document.createElement("div"); body.className = "tool-body";
    const top = document.createElement("div"); top.className = "tool-top";
    const title = document.createElement("h3"); title.className = "tool-name"; title.textContent = name;
    top.appendChild(title);
    if (tool.version) { const version = document.createElement("span"); version.className = "tool-version"; version.textContent = `v${String(tool.version).replace(/^v/i, "")}`; top.appendChild(version); }
    const desc = document.createElement("p"); desc.className = "tool-description"; desc.textContent = description;
    const meta = document.createElement("div"); meta.className = "tool-meta";
    const category = document.createElement("span"); category.className = "tool-category"; category.textContent = String(tool.category || "Tool");
    const action = document.createElement("span"); action.className = "tool-open"; action.textContent = `${text("open")} →`;
    meta.append(category, action); body.append(top, desc, meta); card.append(media, body);

    const open = () => openDialog(tool);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    return card;
  }

  function render() {
    const query = state.query.trim().toLowerCase();
    const matches = state.tools.filter((tool) => {
      const localizedValues = Object.values(tool.name && typeof tool.name === "object" ? tool.name : {}).concat(Object.values(tool.description && typeof tool.description === "object" ? tool.description : {}));
      const legacyValues = [tool.name_de, tool.name_en, tool.description_de, tool.description_en];
      const haystack = [...localizedValues, ...legacyValues, tool.category || "", tool.version || "", ...(Array.isArray(tool.tags) ? tool.tags : [])].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });
    $("toolCount").textContent = String(matches.length);
    const grid = $("toolGrid"); grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    matches.forEach((tool) => fragment.appendChild(makeToolCard(tool)));
    grid.appendChild(fragment);
    const empty = $("emptyState");
    const error = $("errorState");
    error.classList.add("is-hidden");
    empty.classList.toggle("is-hidden", matches.length > 0 || state.tools.length > 0);
    if (matches.length === 0 && state.tools.length > 0) {
      empty.classList.remove("is-hidden");
      empty.querySelector("h3").textContent = text("empty.searchTitle");
      empty.querySelector("p").textContent = text("empty.searchText");
    } else {
      empty.querySelector("h3").textContent = text("empty.title");
      empty.querySelector("p").textContent = text("empty.text");
    }
  }

  async function loadTools() {
    try {
      const response = await fetch(`${CONFIG.toolsDataUrl}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload?.tools;
      if (!Array.isArray(list)) throw new Error("Invalid tool index");
      state.tools = list.map(normalizeTool).filter(Boolean);
      $("errorState").classList.add("is-hidden");
      render();
    } catch {
      state.tools = [];
      $("toolGrid").replaceChildren();
      $("emptyState").classList.add("is-hidden");
      $("errorState").classList.remove("is-hidden");
      $("toolCount").textContent = "0";
    }
  }

  function openDialog(tool) {
    if (!tool) return;
    state.galleryTool = tool;
    state.galleryIndex = 0;
    updateDialog();
    const dialog = $("toolDialog");
    if (!dialog.open) dialog.showModal();
  }

  function updateDialog() {
    const tool = state.galleryTool;
    if (!tool) return;
    const images = tool.screenshots;
    const image = $("dialogImage");
    if (images.length) { image.src = images[state.galleryIndex]; image.alt = `${chooseLocalized(tool, "name")} screenshot ${state.galleryIndex + 1}`; }
    else { image.removeAttribute("src"); image.alt = ""; }
    $("prevShot").disabled = images.length < 2;
    $("nextShot").disabled = images.length < 2;
    $("dialogCategory").textContent = String(tool.category || "Tool");
    $("dialogTitle").textContent = chooseLocalized(tool, "name") || tool.slug;
    $("dialogDescription").textContent = chooseLocalized(tool, "description");
    $("dialogVersion").textContent = tool.version ? `v${String(tool.version).replace(/^v/i, "")}` : "";
    const tags = Array.isArray(tool.tags) ? tool.tags.join(" · ") : "";
    $("dialogTags").textContent = tags;
    $("dialogDownload").textContent = text("download");
    $("dialogDownload").href = tool.download;
  }

  function closeDialog() { $("toolDialog").close(); state.galleryTool = null; }

  document.addEventListener("DOMContentLoaded", () => {
    $("year").textContent = String(new Date().getFullYear());
    $("languageSelect").addEventListener("change", (e) => applyLanguage(e.target.value));
    $("searchInput").addEventListener("input", (e) => { state.query = e.target.value; render(); });
    $("dialogClose").addEventListener("click", closeDialog);
    $("prevShot").addEventListener("click", () => { if (!state.galleryTool?.screenshots?.length) return; state.galleryIndex = (state.galleryIndex - 1 + state.galleryTool.screenshots.length) % state.galleryTool.screenshots.length; updateDialog(); });
    $("nextShot").addEventListener("click", () => { if (!state.galleryTool?.screenshots?.length) return; state.galleryIndex = (state.galleryIndex + 1) % state.galleryTool.screenshots.length; updateDialog(); });
    $("toolDialog").addEventListener("click", (e) => { if (e.target === $("toolDialog")) closeDialog(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("toolDialog").open) closeDialog(); });
    applyLanguage(detectLanguage());
    loadTools();
  });
})();
