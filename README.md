# C2V3ZA Tools — GitHub Pages

Diese Version ist für das Repository **https://github.com/C2V3ZA/tools/** vorbereitet.
Sie läuft als statische GitHub-Pages-Webseite und benötigt **keinen lokalen Node.js-Server**.

## Bereits konfigurierte Werte

In `config.js` sind die öffentlichen Repository-Daten bereits eingetragen:

- GitHub Owner: `C2V3ZA`
- Repository: `tools`
- Branch: `main`
- Admin-GitHub-Username: `C2V3ZA`
- GitHub API: `https://api.github.com`
- GitHub-Pages-URL: `https://c2v3za.github.io/tools/`
- Tool-Index: `data/tools.json`
- Tool-Uploads: `assets/tools/`
- Screenshot-Uploads: `assets/screenshots/`

**Kein GitHub-Token und kein Passwort wird in `config.js` gespeichert.**

## GitHub Pages aktivieren

Der Workflow in `.github/workflows/pages.yml` deployed die Website bei Pushes auf `main`.
Auf GitHub unter **Settings → Pages** als Quelle **GitHub Actions** auswählen.

## Admin

Öffne anschließend:

`https://c2v3za.github.io/tools/admin.html`

Der Admin prüft über GitHub:

1. das eingegebene Konto,
2. dass der Login exakt `C2V3ZA` entspricht,
3. dass das Token Zugriff auf `C2V3ZA/tools` hat,
4. dass `data/tools.json` vorhanden ist.

Für den Upload wird ein **Fine-grained Personal Access Token** mit mindestens
`Contents: Read and write` für ausschließlich das Repository `C2V3ZA/tools` benötigt.
Das Token wird nur im Arbeitsspeicher des aktuellen Tabs gehalten und nicht in
`localStorage`, Cookies oder Dateien gespeichert.

## Tool-Uploads

Pro Tool kannst du hochladen:

- 1 ZIP-Paket, maximal 25 MB
- bis zu 4 Screenshots
- PNG, JPG/JPEG oder WebP
- maximal 5 MB je Screenshot

ZIPs werden nicht entpackt oder auf der Webseite ausgeführt. Die Oberfläche rendert
Benutzerdaten mit DOM-APIs und `textContent`, nicht mit ungefiltertem HTML.

## Repository-Struktur

```text
C2V3ZA/tools/
├── .github/workflows/pages.yml
├── admin.css
├── admin.html
├── admin.js
├── app.js
├── config.js
├── data/tools.json
├── index.html
├── styles.css
├── assets/tools/
└── assets/screenshots/
```

## Wichtiger Sicherheitshinweis

Eine rein statische GitHub-Pages-Seite kann **kein geheimes eigenes Admin-Passwort**
serverseitig prüfen. Deshalb erfolgt die Berechtigung über GitHub. Der Token darf
niemals fest in den veröffentlichten Dateien hinterlegt werden.
