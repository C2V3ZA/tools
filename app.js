(() => {
  "use strict";
  const T = {"en": {"nav.tools": "Tools", "nav.about": "About", "hero.eyebrow": "PRIVATE TOOL COLLECTION", "hero.text": "A clean home for my tools, utilities and projects.", "hero.button": "Browse tools", "tools.kicker": "COLLECTION", "tools.title": "Available tools", "tools.search": "Search tools...", "tools.searchLabel": "Search tools", "empty.title": "No tools found", "empty.text": "Try a different search term.", "error.title": "Could not load the collection", "error.text": "Check that data/tools.json is available.", "about.kicker": "ABOUT", "about.title": "Built for a focused collection.", "about.text": "The site is static and GitHub Pages friendly. The private admin panel is kept separate and never shipped with this public website.", "about.platform": "Platform", "about.language": "Language", "about.status": "Status", "footer.text": "Built for GitHub Pages.", "download": "Download"}, "de": {"nav.tools": "Tools", "nav.about": "Über uns", "hero.eyebrow": "PRIVATE TOOL-SAMMLUNG", "hero.text": "Ein sauberer Ort für meine Tools, Hilfsprogramme und Projekte.", "hero.button": "Tools ansehen", "tools.kicker": "SAMMLUNG", "tools.title": "Verfügbare Tools", "tools.search": "Tools suchen...", "tools.searchLabel": "Tools suchen", "empty.title": "Keine Tools gefunden", "empty.text": "Versuche einen anderen Suchbegriff.", "error.title": "Sammlung konnte nicht geladen werden", "error.text": "Prüfe, ob data/tools.json erreichbar ist.", "about.kicker": "ÜBER C2V3ZA", "about.title": "Gemacht für eine fokussierte Sammlung.", "about.text": "Die Website ist statisch und für GitHub Pages gebaut. Das private Admin-Panel bleibt getrennt und wird niemals mit der öffentlichen Website veröffentlicht.", "about.platform": "Plattform", "about.language": "Sprache", "about.status": "Status", "footer.text": "Für GitHub Pages gebaut.", "download": "Download"}};
  const STORAGE_KEY = SITE_CONFIG.languageStorageKey;
  const SUPPORTED = SITE_CONFIG.supportedLanguages;
  const FALLBACK = SITE_CONFIG.defaultLanguage;
  const state = { lang: FALLBACK, tools: [], query: "" };
  const $ = (id) => document.getElementById(id);

  function detectLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
    const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language || ""];
    for (const raw of candidates) {
      const lang = String(raw).toLowerCase().split("-")[0];
      if (SUPPORTED.includes(lang)) return lang;
    }
    return FALLBACK;
  }
  function tr(key) { return T[state.lang]?.[key] ?? T[FALLBACK]?.[key] ?? key; }
  function applyLanguage(lang) {
    state.lang = SUPPORTED.includes(lang) ? lang : FALLBACK;
    localStorage.setItem(STORAGE_KEY, state.lang);
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = tr(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => el.setAttribute("placeholder", tr(el.dataset.i18nPlaceholder)));
    $("languageSelect").value = state.lang;
    $("detectedLanguage").textContent = state.lang.toUpperCase();
    document.title = "C2V3ZA Tools";
    render();
  }
  function safeAssetPath(path, prefix) {
    if (typeof path !== "string" || path.includes("..") || path.startsWith("/") || !path.startsWith(prefix)) return null;
    return encodeURI(path);
  }
  function chooseText(tool, base) {
    return String(tool[`${base}_${state.lang}`] || tool[`${base}_${FALLBACK}`] || tool[base] || "");
  }
  function card(tool) {
    const article = document.createElement("article");
    article.className = "tool-card";
    const media = document.createElement("div");
    media.className = "tool-media";
    const shots = Array.isArray(tool.screenshots) ? tool.screenshots : [];
    const first = shots.length ? safeAssetPath(shots[0], "assets/screenshots/") : null;
    const fallback = () => {
      media.replaceChildren();
      const no = document.createElement("div"); no.className = "no-preview"; no.textContent = "⌁"; media.appendChild(no);
    };
    if (first) {
      const img = document.createElement("img");
      img.loading = "lazy"; img.decoding = "async"; img.alt = chooseText(tool, "name") + " screenshot"; img.src = first;
      img.addEventListener("error", fallback); media.appendChild(img);
    } else fallback();

    const body = document.createElement("div"); body.className = "tool-body";
    const top = document.createElement("div"); top.className = "tool-top";
    const title = document.createElement("h3"); title.className = "tool-name"; title.textContent = chooseText(tool, "name") || "Unnamed tool";
    top.appendChild(title);
    if (tool.version) { const ver = document.createElement("span"); ver.className = "tool-version"; ver.textContent = "v" + String(tool.version).replace(/^v/i,""); top.appendChild(ver); }
    const desc = document.createElement("p"); desc.className = "tool-description"; desc.textContent = chooseText(tool,"description");
    const meta = document.createElement("div"); meta.className = "tool-meta";
    const cat = document.createElement("span"); cat.className = "tool-category"; cat.textContent = String(tool.category || "Tool"); meta.appendChild(cat);
    const link = document.createElement("a"); link.className = "tool-download"; link.textContent = tr("download") + " ↓";
    const dl = safeAssetPath(tool.download || "", "downloads/");
    link.href = dl || "#"; if (dl) link.setAttribute("download",""); else link.setAttribute("aria-disabled","true");
    meta.appendChild(link); body.append(top,desc,meta); article.append(media,body); return article;
  }
  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = state.tools.filter(tool => {
      const text = [chooseText(tool,"name"),chooseText(tool,"description"),tool.category || "",tool.version || "",...(Array.isArray(tool.tags)?tool.tags:[])].join(" ").toLowerCase();
      return !q || text.includes(q);
    });
    $("toolCount").textContent = String(filtered.length);
    const grid = $("toolGrid"); grid.replaceChildren();
    $("emptyState").hidden = filtered.length !== 0;
    const fragment = document.createDocumentFragment();
    filtered.forEach(tool => fragment.appendChild(card(tool)));
    grid.appendChild(fragment);
  }
  async function loadTools() {
    try {
      const r = await fetch("data/tools.json", {cache:"no-store"});
      if (!r.ok) throw new Error("tools.json");
      const d = await r.json();
      state.tools = Array.isArray(d) ? d : (Array.isArray(d.tools) ? d.tools : []);
      $("loadError").hidden = true; render();
    } catch {
      $("loadError").hidden = false; $("toolGrid").replaceChildren();
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("year").textContent = String(new Date().getFullYear());
    $("languageSelect").addEventListener("change", e => applyLanguage(e.target.value));
    $("searchInput").addEventListener("input", e => { state.query = e.target.value; render(); });
    applyLanguage(detectLanguage());
    loadTools();
  });
})();
