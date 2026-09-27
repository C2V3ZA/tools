(() => {
  const state = { tools: [], query: '', category: '' };
  const $ = (s) => document.querySelector(s);
  const toolsEl = $('#tools');
  const emptyEl = $('#empty');
  const countEl = $('#count');
  const categoryEl = $('#category');

  function safePath(v) {
    return String(v || '').split('/').map(encodeURIComponent).join('/');
  }

  function makeCard(tool) {
    const card = document.createElement('article');
    card.className = 'card';

    const thumb = document.createElement('div'); thumb.className = 'thumb';
    if (Array.isArray(tool.screenshots) && tool.screenshots.length) {
      const img = document.createElement('img');
      img.loading = 'lazy'; img.alt = tool.name + ' Screenshot';
      img.src = safePath(tool.screenshots[0]);
      thumb.appendChild(img);
    } else { const t = document.createElement('div'); t.className='thumb-empty'; t.textContent='NO SCREENSHOT'; thumb.appendChild(t); }

    const body = document.createElement('div'); body.className='body';
    const tag = document.createElement('div'); tag.className='tag'; tag.textContent=(tool.category || 'TOOL').toUpperCase();
    const title = document.createElement('h2'); title.className='title'; title.textContent=tool.name || 'Untitled';
    const desc = document.createElement('div'); desc.className='desc'; desc.textContent=tool.description || '';
    const meta = document.createElement('div'); meta.className='meta';
    const version = document.createElement('span'); version.textContent=tool.version ? 'v'+tool.version : 'ZIP';
    const size = document.createElement('span'); size.textContent=tool.sizeLabel || '';
    meta.append(version,size);

    const actions = document.createElement('div'); actions.className='actions';
    const download = document.createElement('a'); download.className='primary'; download.textContent='DOWNLOAD';
    download.href=safePath(tool.file); download.setAttribute('download','');
    actions.appendChild(download);
    if (tool.screenshots?.length > 1) {
      const shots = document.createElement('a'); shots.textContent=`${tool.screenshots.length} SHOTS`; shots.href=safePath(tool.screenshots[0]); shots.target='_blank'; shots.rel='noopener noreferrer'; actions.appendChild(shots);
    }
    body.append(tag,title,desc,meta,actions); card.append(thumb,body); return card;
  }

  function render() {
    const filtered = state.tools.filter(t => {
      const q = state.query.trim().toLowerCase();
      const hay = [t.name,t.description,t.category,(t.tags||[]).join(' ')].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!state.category || t.category === state.category);
    });
    toolsEl.replaceChildren(...filtered.map(makeCard));
    emptyEl.hidden = filtered.length !== 0;
    countEl.textContent = `${filtered.length} TOOL${filtered.length === 1 ? '' : 'S'}`;
  }

  async function init() {
    try {
      const res = await fetch('data/tools.json', { credentials:'omit', cache:'no-store' });
      if (!res.ok) throw new Error('tools.json could not be loaded');
      const json = await res.json();
      state.tools = Array.isArray(json.tools) ? json.tools : [];
      const categories = [...new Set(state.tools.map(t => t.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      for (const c of categories) { const o = document.createElement('option'); o.value=c; o.textContent=c; categoryEl.appendChild(o); }
      render();
    } catch (e) { toolsEl.replaceChildren(); emptyEl.hidden=false; emptyEl.textContent='Tool-Liste konnte nicht geladen werden.'; countEl.textContent='ERROR'; }
  }
  $('#search').addEventListener('input', e => { state.query=e.target.value.slice(0,80); render(); });
  categoryEl.addEventListener('change', e => { state.category=e.target.value; render(); });
  init();
})();
