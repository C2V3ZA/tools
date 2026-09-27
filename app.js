(() => {
  'use strict';

  const grid = document.getElementById('tools-grid');
  const year = document.getElementById('year');
  const toolsUrl = new URL('data/tools.json', document.baseURI);

  if (year) year.textContent = String(new Date().getFullYear());

  function safeUrl(path) {
    if (typeof path !== 'string') return null;
    if (/^(javascript|data|vbscript):/i.test(path.trim())) return null;
    return new URL(path, document.baseURI).href;
  }

  function createToolCard(tool) {
    const article = document.createElement('article');
    article.className = 'tool-card';

    const media = document.createElement('div');
    media.className = 'tool-media';

    const screenshots = Array.isArray(tool.screenshots) ? tool.screenshots : [];
    if (screenshots.length) {
      const first = safeUrl(screenshots[0]);
      if (first) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = first;
        img.alt = `${String(tool.name || 'Tool')} Screenshot`;
        media.appendChild(img);
      }
    }
    if (!media.firstChild) {
      const placeholder = document.createElement('div');
      placeholder.className = 'tool-placeholder';
      placeholder.textContent = 'NO PREVIEW';
      media.appendChild(placeholder);
    }

    const body = document.createElement('div');
    body.className = 'tool-body';

    const meta = document.createElement('div');
    meta.className = 'tool-meta';
    const category = document.createElement('span');
    category.className = 'tool-category';
    category.textContent = String(tool.category || 'Tool');
    const count = document.createElement('span');
    count.className = 'tool-shot-count';
    count.textContent = `${screenshots.length} Screenshot${screenshots.length === 1 ? '' : 's'}`;
    meta.append(category, count);

    const title = document.createElement('h3');
    title.textContent = String(tool.name || 'Untitled Tool');

    const description = document.createElement('p');
    description.textContent = String(tool.description || '');

    const actions = document.createElement('div');
    actions.className = 'tool-actions';
    const downloadUrl = safeUrl(tool.download);
    if (downloadUrl) {
      const link = document.createElement('a');
      link.className = 'button primary small-button';
      link.href = downloadUrl;
      link.setAttribute('download', '');
      link.textContent = 'ZIP herunterladen';
      actions.appendChild(link);
    }

    if (screenshots.length > 1) {
      const shots = document.createElement('div');
      shots.className = 'thumb-row';
      screenshots.slice(0, 4).forEach((shot, index) => {
        const src = safeUrl(shot);
        if (!src) return;
        const thumb = document.createElement('a');
        thumb.href = src;
        thumb.target = '_blank';
        thumb.rel = 'noopener noreferrer';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = src;
        img.alt = `Screenshot ${index + 1}`;
        thumb.appendChild(img);
        shots.appendChild(thumb);
      });
      body.appendChild(shots);
    }

    body.append(meta, title, description, actions);
    article.append(media, body);
    return article;
  }

  async function loadTools() {
    try {
      const response = await fetch(`${toolsUrl.href}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const tools = await response.json();
      if (!Array.isArray(tools)) throw new Error('Invalid tools index');

      grid.replaceChildren();
      if (tools.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'loading-card';
        empty.textContent = 'Noch keine Tools veröffentlicht.';
        grid.appendChild(empty);
        return;
      }
      tools.forEach((tool) => grid.appendChild(createToolCard(tool)));
    } catch {
      const error = document.createElement('div');
      error.className = 'loading-card';
      error.textContent = 'Tool-Index konnte nicht geladen werden.';
      grid.replaceChildren(error);
    }
  }

  loadTools();
})();
