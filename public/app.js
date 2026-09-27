'use strict';

const API_BASE = String(window.APP_CONFIG?.API_BASE || '').replace(/\/$/, '');

function api(path) {
  return `${API_BASE}${path}`;
}

function escapeDisplayNumber(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function renderTool(tool) {
  const card = document.createElement('article');
  card.className = 'tool-card';

  const meta = document.createElement('div');
  meta.className = 'tool-meta';
  const category = document.createElement('span');
  category.className = 'tool-category';
  category.textContent = String(tool.category || 'Tool');
  const date = document.createElement('span');
  date.textContent = tool.createdAt ? new Date(tool.createdAt).toLocaleDateString('de-DE') : '';
  meta.append(category, date);

  const screenshots = Array.isArray(tool.screenshots) ? tool.screenshots : [];
  if (screenshots.length) {
    const gallery = document.createElement('div');
    gallery.className = 'tool-screenshots';
    for (const shot of screenshots.slice(0, 4)) {
      const link = document.createElement('a');
      link.className = 'tool-shot';
      link.href = String(shot.url || '');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Screenshot von ${String(tool.name || 'Tool')}`);
      const image = document.createElement('img');
      image.src = String(shot.url || '');
      image.alt = `Screenshot von ${String(tool.name || 'Tool')}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      link.appendChild(image);
      gallery.appendChild(link);
    }
    card.appendChild(gallery);
  }

  const title = document.createElement('h3');
  title.textContent = String(tool.name || 'Unnamed tool');
  const desc = document.createElement('p');
  desc.textContent = String(tool.description || 'Privates Tool-Paket.');

  const bottom = document.createElement('div');
  bottom.className = 'tool-bottom';
  const size = document.createElement('span');
  size.className = 'tool-size';
  size.textContent = escapeDisplayNumber(tool.size);
  const link = document.createElement('a');
  link.className = 'tool-download';
  link.href = api(`/api/tools/${encodeURIComponent(String(tool.id))}/download`);
  link.textContent = 'ZIP ↓';
  link.setAttribute('download', '');
  bottom.append(size, link);

  card.append(meta, title, desc, bottom);
  return card;
}

async function loadTools() {
  const grid = document.getElementById('tools-grid');
  try {
    const response = await fetch(api('/api/tools'), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Failed');
    const tools = await response.json();
    grid.replaceChildren();
    if (!Array.isArray(tools) || tools.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent = 'Noch keine Tools veröffentlicht.';
      empty.style.gridColumn = '1 / -1';
      grid.appendChild(empty);
      return;
    }
    for (const tool of tools) grid.appendChild(renderTool(tool));
  } catch {
    grid.replaceChildren();
    const error = document.createElement('div');
    error.className = 'empty-card';
    error.style.gridColumn = '1 / -1';
    error.textContent = 'Tool-Index nicht erreichbar. Prüfe den API-Server.';
    grid.appendChild(error);
  }
}

document.getElementById('year').textContent = String(new Date().getFullYear());
loadTools();
