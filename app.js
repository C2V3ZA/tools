(() => {
  "use strict";
  const C = window.C2V3ZA_CONFIG;
  const T = {
    en: {
      "nav.tools":"Tools","nav.about":"About","lang.label":"Language",
      "hero.kicker":"PRIVATE TOOL COLLECTION","hero.lead":"A clean, focused home for my tools, utilities and projects.","hero.browse":"Browse tools","hero.repo":"Open GitHub ↗",
      "trust.pages":"GitHub Pages","trust.static":"Static","trust.private":"Private admin",
      "term.loaded":"tool index ready","term.screens":"screenshot support enabled","term.language":"language auto-detected","term.deploy":"deployment ready","term.repository":"repository","term.branch":"branch","term.toolcount":"published tools",
      "tools.kicker":"COLLECTION","tools.title":"Available tools","tools.subtitle":"Search and open a tool.","tools.searchlabel":"Search tools","tools.search":"Search tools...",
      "empty.title":"No tools published yet","empty.text":"Publish a tool from the separate local admin.","empty.searchTitle":"No matching tools","empty.searchText":"Try another search term.",
      "error.title":"Collection unavailable","error.text":"The tool index could not be loaded. Check the GitHub Pages deployment.",
      "about.kicker":"ABOUT","about.title":"Built for a focused collection.","about.text":"C2V3ZA Tools is a static GitHub Pages site. The private admin stays on your machine and is never shipped with the public site.","about.platform":"Platform","about.repo":"Repository","about.language":"Language","about.status":"Status","about.online":"Online",
      "footer":"GitHub Pages · private publishing workflow","download":"Download tool","open":"View details","screenshots":"Screenshots"
    },
    de: {
      "nav.tools":"Tools","nav.about":"Über uns","lang.label":"Sprache",
      "hero.kicker":"PRIVATE TOOL-SAMMLUNG","hero.lead":"Ein sauberer, fokussierter Ort für meine Tools, Hilfsprogramme und Projekte.","hero.browse":"Tools ansehen","hero.repo":"GitHub öffnen ↗",
      "trust.pages":"GitHub Pages","trust.static":"Statisch","trust.private":"Privates Admin",
      "term.loaded":"Tool-Index bereit","term.screens":"Screenshot-Unterstützung aktiv","term.language":"Sprache automatisch erkannt","term.deploy":"Deployment bereit","term.repository":"Repository","term.branch":"Branch","term.toolcount":"veröffentlichte Tools",
      "tools.kicker":"SAMMLUNG","tools.title":"Verfügbare Tools","tools.subtitle":"Suche und öffne ein Tool.","tools.searchlabel":"Tools suchen","tools.search":"Tools suchen...",
      "empty.title":"Noch keine Tools veröffentlicht","empty.text":"Veröffentliche ein Tool über das separate lokale Admin.","empty.searchTitle":"Keine passenden Tools","empty.searchText":"Versuche einen anderen Suchbegriff.",
      "error.title":"Sammlung nicht verfügbar","error.text":"Der Tool-Index konnte nicht geladen werden. Prüfe das GitHub-Pages-Deployment.",
      "about.kicker":"ÜBER C2V3ZA","about.title":"Für eine fokussierte Sammlung gebaut.","about.text":"C2V3ZA Tools ist eine statische GitHub-Pages-Seite. Das private Admin bleibt auf deinem Rechner und wird nicht mit der öffentlichen Website ausgeliefert.","about.platform":"Plattform","about.repo":"Repository","about.language":"Sprache","about.status":"Status","about.online":"Online",
      "footer":"GitHub Pages · privater Publishing-Workflow","download":"Tool herunterladen","open":"Details ansehen","screenshots":"Screenshots"
    }
  };
  const state = { lang:C.defaultLanguage, tools:[], query:"", galleryTool:null, galleryIndex:0 };
  const $ = id => document.getElementById(id);
  const tr = k => T[state.lang]?.[k] ?? T[C.defaultLanguage][k] ?? k;
  const baseName = v => String(v || "").trim().split("/").pop();

  function detectLanguage(){
    try { const saved=localStorage.getItem(C.languageStorageKey); if(C.languages.includes(saved)) return saved; } catch {}
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
    for(const raw of langs){ const b=String(raw).toLowerCase().split("-")[0]; if(C.languages.includes(b)) return b; }
    return C.defaultLanguage;
  }
  function applyLanguage(lang){
    state.lang=C.languages.includes(lang)?lang:C.defaultLanguage;
    try{localStorage.setItem(C.languageStorageKey,state.lang);}catch{}
    document.documentElement.lang=state.lang;
    document.querySelectorAll("[data-i18n]").forEach(n=>n.textContent=tr(n.dataset.i18n));
    document.querySelectorAll("[data-i18n-placeholder]").forEach(n=>n.placeholder=tr(n.dataset.i18nPlaceholder));
    $("languageSelect").value=state.lang; $("languageStatus").textContent=state.lang.toUpperCase(); render();
  }
  function safePath(value,prefix){
    if(typeof value!=="string"||!value||value.includes("\\")||value.includes("..")||value.startsWith("/")||!value.startsWith(prefix)) return null;
    return `./${value}`;
  }
  function normalize(raw){
    if(!raw||typeof raw!=="object") return null;
    const slug=String(raw.slug||"").trim(); if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    if(raw.published===false) return null;
    const download=safePath(raw.download,"downloads/"); if(!download) return null;
    const shots=Array.isArray(raw.screenshots)?raw.screenshots.map(x=>safePath(x,"assets/screenshots/")).filter(Boolean):[];
    return {...raw,slug,download,screenshots:shots};
  }
  function localized(tool,field){
    const val=tool?.[field];
    if(val&&typeof val==="object") return String(val[state.lang]??val[C.defaultLanguage]??Object.values(val)[0]??"");
    return String(tool?.[`${field}_${state.lang}`]??tool?.[`${field}_${C.defaultLanguage}`]??val??"");
  }
  function card(tool){
    const card=document.createElement("article"); card.className="tool-card"; card.tabIndex=0; card.setAttribute("role","button");
    const media=document.createElement("div"); media.className="tool-media";
    if(tool.screenshots[0]){const img=document.createElement("img"); img.loading="lazy"; img.decoding="async"; img.src=tool.screenshots[0]; img.alt=`${localized(tool,"name")||tool.slug} screenshot`; img.onerror=()=>{media.replaceChildren(noImage())}; media.appendChild(img);} else media.appendChild(noImage());
    if(tool.screenshots.length){const badge=document.createElement("span");badge.className="shot-badge";badge.textContent=`${tool.screenshots.length} ${tr("screenshots")}`;media.appendChild(badge);}
    const body=document.createElement("div");body.className="tool-body";
    const top=document.createElement("div");top.className="tool-top";
    const h=document.createElement("h3");h.className="tool-name";h.textContent=localized(tool,"name")||tool.slug;
    const v=document.createElement("span");v.className="tool-version";v.textContent=tool.version?`v${String(tool.version).replace(/^v/i,"")}`:""; top.append(h,v);
    const p=document.createElement("p");p.className="tool-desc";p.textContent=localized(tool,"description");
    const meta=document.createElement("div");meta.className="tool-meta";const cat=document.createElement("span");cat.className="category";cat.textContent=String(tool.category||"Tool");const open=document.createElement("span");open.className="open";open.textContent=`${tr("open")} →`;meta.append(cat,open);
    body.append(top,p,meta);card.append(media,body);
    const openIt=()=>openDialog(tool); card.addEventListener("click",openIt); card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openIt();}}); return card;
  }
  function noImage(){const d=document.createElement("div");d.className="tool-no-image";d.textContent="+";return d;}
  function render(){
    const q=state.query.trim().toLowerCase(); const matches=state.tools.filter(t=>{const all=[];for(const f of ["name","description"])if(t[f]&&typeof t[f]==="object")all.push(...Object.values(t[f]));all.push(t.category||"",t.version||"",...(Array.isArray(t.tags)?t.tags:[]),t.slug);return !q||all.join(" ").toLowerCase().includes(q);});
    $("toolCount").textContent=String(matches.length); $("terminalToolCount").textContent=String(state.tools.length); const grid=$("toolGrid");grid.replaceChildren();const frag=document.createDocumentFragment();matches.forEach(t=>frag.appendChild(card(t)));grid.appendChild(frag);
    const empty=$("emptyState"); if(!state.tools.length){empty.classList.remove("hidden");empty.querySelector("h3").textContent=tr("empty.title");empty.querySelector("p").textContent=tr("empty.text");}
    else if(!matches.length){empty.classList.remove("hidden");empty.querySelector("h3").textContent=tr("empty.searchTitle");empty.querySelector("p").textContent=tr("empty.searchText");}
    else empty.classList.add("hidden");
  }
  async function load(){try{const r=await fetch(`${C.toolsDataUrl}?v=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error();const p=await r.json();const arr=Array.isArray(p)?p:p?.tools;if(!Array.isArray(arr))throw new Error();state.tools=arr.map(normalize).filter(Boolean);$("errorState").classList.add("hidden");render();}catch{$("toolGrid").replaceChildren();$("emptyState").classList.add("hidden");$("errorState").classList.remove("hidden");$("toolCount").textContent="0";$("terminalToolCount").textContent="0";}}
  function openDialog(tool){state.galleryTool=tool;state.galleryIndex=0;updateDialog();if(!$("toolDialog").open)$("toolDialog").showModal();}
  function updateDialog(){const t=state.galleryTool;if(!t)return;const shots=t.screenshots||[];const img=$("dialogImage");if(shots.length){img.src=shots[state.galleryIndex];img.alt=`${localized(t,"name")} screenshot ${state.galleryIndex+1}`;}else{img.removeAttribute("src");img.alt="";}$("prevShot").disabled=shots.length<2;$("nextShot").disabled=shots.length<2;$("dialogCategory").textContent=String(t.category||"Tool");$("dialogTitle").textContent=localized(t,"name")||t.slug;$("dialogDescription").textContent=localized(t,"description");$("dialogVersion").textContent=t.version?`v${String(t.version).replace(/^v/i,"")}`:"";$("dialogTags").textContent=Array.isArray(t.tags)?t.tags.join(" · "):"";$("dialogDownload").textContent=tr("download");$("dialogDownload").href=t.download;}
  function closeDialog(){if($("toolDialog").open)$("toolDialog").close();state.galleryTool=null;}
  document.addEventListener("DOMContentLoaded",()=>{
    $("year").textContent=new Date().getFullYear(); $("languageSelect").addEventListener("change",e=>applyLanguage(e.target.value)); $("searchInput").addEventListener("input",e=>{state.query=e.target.value;render();}); $("dialogClose").addEventListener("click",closeDialog); $("prevShot").addEventListener("click",()=>{const n=state.galleryTool?.screenshots?.length||0;if(n>1){state.galleryIndex=(state.galleryIndex-1+n)%n;updateDialog();}});$("nextShot").addEventListener("click",()=>{const n=state.galleryTool?.screenshots?.length||0;if(n>1){state.galleryIndex=(state.galleryIndex+1)%n;updateDialog();}});$("toolDialog").addEventListener("click",e=>{if(e.target===$("toolDialog"))closeDialog();});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("toolDialog").open)closeDialog();});applyLanguage(detectLanguage());load();
  });
})();
