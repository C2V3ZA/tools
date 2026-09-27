'use strict';

const API_BASE = String(window.APP_CONFIG?.API_BASE || '').replace(/\/$/, '');
const api = (path) => `${API_BASE}${path}`;
let csrfToken = '';

function setStatus(element, message, kind = '') {
  element.textContent = message;
  element.className = `status ${kind}`.trim();
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(api(path), {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    }
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function refreshCsrf() {
  const data = await jsonRequest('/api/auth/csrf');
  csrfToken = String(data?.token || '');
}

function setAuthenticated(state) {
  document.getElementById('login-panel').classList.toggle('hidden', state);
  document.getElementById('dashboard').classList.toggle('hidden', !state);
}

async function checkAuth() {
  try {
    const status = await jsonRequest('/api/auth/status');
    if (status?.authenticated) {
      await refreshCsrf();
      setAuthenticated(true);
      await loadAdminTools();
      return;
    }
  } catch {}
  setAuthenticated(false);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('login-status');
  setStatus(status, 'Signing in…');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  try {
    await jsonRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    form.reset();
    await refreshCsrf();
    setStatus(status, 'Authenticated.', 'success');
    setAuthenticated(true);
    await loadAdminTools();
  } catch (error) {
    setStatus(status, error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await jsonRequest('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken }
    });
  } catch {}
  csrfToken = '';
  setAuthenticated(false);
}

function renderAdminTool(tool) {
  const item = document.createElement('article');
  item.className = 'admin-tool';
  const content = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = String(tool.name || 'Unnamed tool');
  const meta = document.createElement('p');
  meta.textContent = `${String(tool.category || 'Tool')} · ${String(tool.originalName || 'ZIP')} · ${Array.isArray(tool.screenshots) ? tool.screenshots.length : 0} Screenshot(s)`;
  content.append(title, meta);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'delete-btn';
  button.textContent = 'Delete';
  button.dataset.id = String(tool.id || '');
  button.addEventListener('click', () => deleteTool(button.dataset.id, item));

  item.append(content, button);
  return item;
}

async function loadAdminTools() {
  const container = document.getElementById('admin-tools');
  const count = document.getElementById('tool-count');
  container.replaceChildren();
  try {
    const tools = await jsonRequest('/api/tools');
    count.textContent = String(Array.isArray(tools) ? tools.length : 0);
    if (!Array.isArray(tools) || tools.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Noch keine Tools.';
      empty.style.color = '#756c6f';
      container.appendChild(empty);
      return;
    }
    for (const tool of tools) container.appendChild(renderAdminTool(tool));
  } catch (error) {
    count.textContent = '—';
    const empty = document.createElement('p');
    empty.textContent = error.message;
    empty.style.color = '#ff6469';
    container.appendChild(empty);
    if (error.status === 401) setAuthenticated(false);
  }
}

async function deleteTool(id, node) {
  if (!id || !window.confirm('Dieses Tool wirklich löschen?')) return;
  try {
    await jsonRequest(`/api/tools/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken }
    });
    node.remove();
    await loadAdminTools();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await checkAuth();
    } else {
      window.alert(error.message);
    }
  }
}

async function handleUpload(event) {
  event.preventDefault();
  const status = document.getElementById('upload-status');
  const fileInput = document.getElementById('tool-file');
  const screenshotInput = document.getElementById('tool-screenshots');
  const file = fileInput.files?.[0];
  const screenshots = Array.from(screenshotInput.files || []);
  if (!file) return setStatus(status, 'Bitte eine ZIP-Datei auswählen.', 'error');
  if (!/\.zip$/i.test(file.name)) return setStatus(status, 'Nur .zip ist erlaubt.', 'error');
  if (screenshots.length > 4) return setStatus(status, 'Maximal 4 Screenshots pro Tool.', 'error');
  const invalidShot = screenshots.find((shot) => !/\.(png|jpe?g|webp)$/i.test(shot.name) || shot.size > 5 * 1024 * 1024);
  if (invalidShot) return setStatus(status, 'Screenshots müssen PNG/JPG/WebP sein und jeweils höchstens 5 MB groß sein.', 'error');

  const formData = new FormData();
  formData.append('name', document.getElementById('tool-name').value.trim());
  formData.append('category', document.getElementById('tool-category').value.trim());
  formData.append('description', document.getElementById('tool-description').value.trim());
  formData.append('file', file, file.name);
  for (const shot of screenshots) formData.append('screenshots', shot, shot.name);

  setStatus(status, 'Uploading…');
  try {
    await jsonRequest('/api/tools', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData
    });
    event.currentTarget.reset();
    setStatus(status, 'Tool veröffentlicht.', 'success');
    await loadAdminTools();
  } catch (error) {
    if (error.status === 401 || error.status === 403) await checkAuth();
    setStatus(status, error.message, 'error');
  }
}

document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('logout').addEventListener('click', handleLogout);
document.getElementById('upload-form').addEventListener('submit', handleUpload);
checkAuth();
