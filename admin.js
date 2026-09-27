(() => {
  'use strict';

  const CFG = window.C2V3ZA_CONFIG;
  if (!CFG) return;

  let githubToken = null;
  let githubUser = null;
  let repoMeta = null;

  const loginPanel = document.getElementById('login-panel');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginStatus = document.getElementById('login-status');
  const uploadForm = document.getElementById('upload-form');
  const uploadStatus = document.getElementById('upload-status');
  const adminTools = document.getElementById('admin-tools');
  const toolCount = document.getElementById('tool-count');
  const sessionLabel = document.getElementById('session-label');
  const logoutBtn = document.getElementById('logout');

  const API = String(CFG.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  const headersBase = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': CFG.API_VERSION
  };

  function setStatus(el, text, kind = '') {
    el.textContent = text;
    el.className = `status ${kind}`.trim();
  }

  function authHeaders() {
    return { ...headersBase, Authorization: `Bearer ${githubToken}` };
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const message = data && typeof data === 'object' && data.message ? data.message : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  function bytesToBase64(bytes) {
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    return btoa(binary);
  }

  async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    return bytesToBase64(new Uint8Array(buffer));
  }

  function slugify(value) {
    return String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'tool';
  }

  async function getFile(path) {
    try {
      return await api(`/repos/${encodeURIComponent(CFG.OWNER)}/${encodeURIComponent(CFG.REPO)}/contents/${path}?ref=${encodeURIComponent(CFG.BRANCH)}`);
    } catch (error) {
      if (String(error.message).includes('404')) return null;
      throw error;
    }
  }

  async function putFile(path, contentBase64, message, sha = null) {
    const body = {
      message,
      content: contentBase64,
      branch: CFG.BRANCH
    };
    if (sha) body.sha = sha;
    return api(`/repos/${encodeURIComponent(CFG.OWNER)}/${encodeURIComponent(CFG.REPO)}/contents/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function deleteFile(path, sha, message) {
    return api(`/repos/${encodeURIComponent(CFG.OWNER)}/${encodeURIComponent(CFG.REPO)}/contents/${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: CFG.BRANCH })
    });
  }

  async function readIndex() {
    const file = await getFile(CFG.TOOLS_INDEX_PATH);
    if (!file) return { items: [], sha: null };
    const binary = atob(String(file.content || '').replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const items = JSON.parse(text);
    if (!Array.isArray(items)) throw new Error('data/tools.json ist ungültig.');
    return { items, sha: file.sha };
  }

  function validateSlug(slug, items) {
    const exists = items.some(item => item && item.slug === slug);
    if (exists) throw new Error('Dieses Tool existiert bereits. Verwende einen anderen Namen.');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Ungültiger Tool-Slug.');
  }

  async function magicCheck(file, kind) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const hex = Array.from(head).map(x => x.toString(16).padStart(2, '0')).join('');
    if (kind === 'zip') return hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708');
    if (kind === 'png') return hex.startsWith('89504e470d0a1a0a');
    if (kind === 'jpg') return hex.startsWith('ffd8ff');
    if (kind === 'webp') return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
    return false;
  }

  function screenshotExt(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
    if (name.endsWith('.webp')) return 'webp';
    return null;
  }

  async function checkScreenshots(files) {
    if (files.length > CFG.MAX_SCREENSHOTS) throw new Error(`Maximal ${CFG.MAX_SCREENSHOTS} Screenshots.`);
    for (const file of files) {
      if (file.size > CFG.MAX_SCREENSHOT_BYTES) throw new Error(`Screenshot zu groß: ${file.name}`);
      const ext = screenshotExt(file);
      if (!ext) throw new Error(`Nicht unterstütztes Bildformat: ${file.name}`);
      if (!(await magicCheck(file, ext === 'png' ? 'png' : ext === 'jpg' ? 'jpg' : 'webp'))) {
        throw new Error(`Dateiinhalt passt nicht zum Bildformat: ${file.name}`);
      }
    }
  }

  async function checkZip(file) {
    if (!file) throw new Error('Bitte ein ZIP auswählen.');
    if (file.size > CFG.MAX_TOOL_BYTES) throw new Error(`ZIP zu groß. Limit: ${Math.round(CFG.MAX_TOOL_BYTES / 1024 / 1024)} MB.`);
    if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('Nur .zip-Dateien sind erlaubt.');
    if (!(await magicCheck(file, 'zip'))) throw new Error('Die Datei hat keinen gültigen ZIP-Dateikopf.');
  }

  async function login(username, token) {
    githubToken = token.trim();
    githubUser = await api('/user');
    if (!githubUser || githubUser.login !== username.trim() || githubUser.login !== CFG.ADMIN_GITHUB_USERNAME) {
      throw new Error('Dieses GitHub-Konto ist nicht als Admin konfiguriert.');
    }
    repoMeta = await api(`/repos/${encodeURIComponent(CFG.OWNER)}/${encodeURIComponent(CFG.REPO)}`);
    if (!repoMeta || repoMeta.default_branch !== undefined) {
      if (CFG.BRANCH !== repoMeta.default_branch && !repoMeta.permissions?.push) {
        throw new Error('Das Token hat keinen Schreibzugriff auf das konfigurierte Repository.');
      }
    }
    const indexFile = await getFile(CFG.TOOLS_INDEX_PATH);
    if (!indexFile) {
      throw new Error(`${CFG.TOOLS_INDEX_PATH} fehlt im Repository.`);
    }
  }

  function showDashboard() {
    loginPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
    sessionLabel.textContent = `Angemeldet als ${githubUser.login} · ${CFG.OWNER}/${CFG.REPO}@${CFG.BRANCH}`;
    loadAdminTools();
  }

  function logout() {
    githubToken = null;
    githubUser = null;
    repoMeta = null;
    loginForm.reset();
    dashboard.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    setStatus(loginStatus, 'Abgemeldet. Das Token wurde aus dem Arbeitsspeicher entfernt.');
  }

  function renderAdminTools(items) {
    adminTools.replaceChildren();
    toolCount.textContent = String(items.length);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-admin';
      empty.textContent = 'Noch keine Tools.';
      adminTools.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'admin-tool-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = String(item.name || item.slug || 'Tool');
      const sub = document.createElement('span');
      sub.textContent = String(item.category || '');
      info.append(title, sub);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button danger';
      button.textContent = 'Delete';
      button.addEventListener('click', () => removeTool(item));
      row.append(info, button);
      adminTools.appendChild(row);
    });
  }

  async function loadAdminTools() {
    try {
      const { items } = await readIndex();
      renderAdminTools(items);
    } catch (error) {
      const msg = document.createElement('div');
      msg.className = 'status error';
      msg.textContent = error.message;
      adminTools.replaceChildren(msg);
    }
  }

  async function publishTool(event) {
    event.preventDefault();
    setStatus(uploadStatus, 'Prüfe Dateien …');
    try {
      const name = document.getElementById('tool-name').value.trim();
      const category = document.getElementById('tool-category').value.trim();
      const description = document.getElementById('tool-description').value.trim();
      const zip = document.getElementById('tool-file').files[0];
      const screenshotFiles = Array.from(document.getElementById('tool-screenshots').files || []);
      if (!name || !category) throw new Error('Name und Kategorie sind erforderlich.');
      await checkZip(zip);
      await checkScreenshots(screenshotFiles);

      const slug = slugify(name);
      const { items, sha: indexSha } = await readIndex();
      validateSlug(slug, items);

      setStatus(uploadStatus, 'Lade ZIP zu GitHub hoch …');
      const zipPath = `${CFG.TOOL_UPLOAD_DIR}/${slug}.zip`;
      const zipResult = await putFile(zipPath, await fileToBase64(zip), `Add tool package: ${slug}`);

      const screenshotPaths = [];
      for (let i = 0; i < screenshotFiles.length; i += 1) {
        const file = screenshotFiles[i];
        const ext = screenshotExt(file);
        const shotPath = `${CFG.SCREENSHOT_UPLOAD_DIR}/${slug}/${String(i + 1).padStart(2, '0')}.${ext}`;
        setStatus(uploadStatus, `Lade Screenshot ${i + 1}/${screenshotFiles.length} …`);
        await putFile(shotPath, await fileToBase64(file), `Add screenshot ${i + 1} for ${slug}`);
        screenshotPaths.push(shotPath);
      }

      const record = {
        slug,
        name,
        category,
        description,
        download: zipResult.content?.path ? zipResult.content.path : zipPath,
        screenshots: screenshotPaths,
        updatedAt: new Date().toISOString()
      };
      const updated = [...items, record];
      const json = JSON.stringify(updated, null, 2) + '\n';
      const encoded = bytesToBase64(new TextEncoder().encode(json));
      setStatus(uploadStatus, 'Aktualisiere tools.json …');
      await putFile(CFG.TOOLS_INDEX_PATH, encoded, `Publish tool: ${slug}`, indexSha);

      uploadForm.reset();
      setStatus(uploadStatus, 'Tool veröffentlicht. GitHub Pages übernimmt die Änderung nach dem nächsten Deployment.', 'success');
      renderAdminTools(updated);
    } catch (error) {
      setStatus(uploadStatus, `Fehler: ${error.message}`, 'error');
    }
  }

  async function removeTool(item) {
    const slug = String(item.slug || '');
    if (!slug || !window.confirm(`Tool "${String(item.name || slug)}" wirklich löschen?`)) return;
    setStatus(uploadStatus, 'Lösche Tool …');
    try {
      const zipPath = `${CFG.TOOL_UPLOAD_DIR}/${slug}.zip`;
      const zipFile = await getFile(zipPath);
      if (zipFile) await deleteFile(zipPath, zipFile.sha, `Remove tool package: ${slug}`);

      const screenshots = Array.isArray(item.screenshots) ? item.screenshots : [];
      for (const shot of screenshots) {
        const path = String(shot);
        if (!path.startsWith(`${CFG.SCREENSHOT_UPLOAD_DIR}/${slug}/`)) continue;
        const shotFile = await getFile(path);
        if (shotFile) await deleteFile(path, shotFile.sha, `Remove screenshot for: ${slug}`);
      }

      const index = await readIndex();
      const updated = index.items.filter(entry => entry && entry.slug !== slug);
      const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(updated, null, 2) + '\n'));
      await putFile(CFG.TOOLS_INDEX_PATH, encoded, `Remove tool: ${slug}`, index.sha);
      setStatus(uploadStatus, 'Tool gelöscht.', 'success');
      renderAdminTools(updated);
    } catch (error) {
      setStatus(uploadStatus, `Fehler beim Löschen: ${error.message}`, 'error');
      await loadAdminTools();
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(loginStatus, 'Verifiziere GitHub-Konto …');
    try {
      const username = document.getElementById('username').value.trim();
      const token = document.getElementById('token').value.trim();
      if (!username || !token) throw new Error('Username und Token sind erforderlich.');
      await login(username, token);
      document.getElementById('token').value = '';
      setStatus(loginStatus, 'GitHub-Konto verifiziert.', 'success');
      showDashboard();
    } catch (error) {
      githubToken = null;
      githubUser = null;
      setStatus(loginStatus, `Login fehlgeschlagen: ${error.message}`, 'error');
    }
  });

  uploadForm.addEventListener('submit', publishTool);
  logoutBtn.addEventListener('click', logout);
})();
