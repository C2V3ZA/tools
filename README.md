# C2V3ZA Tools — private tools hub

Ein dunkles, rot akzentuiertes Tools-Dashboard nach dem Look der Referenz: Grid-Hintergrund, große Hero-Typografie, abgerundete Panels und eine kompakte Admin-Ansicht.

## Wichtig: GitHub Pages allein reicht für sichere Admin-Uploads nicht

GitHub Pages ist statisches Hosting. Es kann deshalb **keinen sicheren Admin-Login mit serverseitiger Authentifizierung und Datei-Upload** ausführen.

Dieses Paket enthält deshalb **Frontend + Node.js-API**. Du kannst:

1. das Frontend über GitHub Pages veröffentlichen und die API separat hosten, oder
2. das komplette Projekt auf einem Node.js-Host mit persistentem Speicher deployen.

Für die einfachste und sicherste Einrichtung empfiehlt sich eine gemeinsame Domain bzw. ein Reverse Proxy, sodass Frontend und API unter derselben Origin laufen.

## Start lokal

```bash
npm install
cp .env.example .env
npm run hash-password "DEIN-SEHR-STARKES-PASSWORT"
```

Den ausgegebenen `scrypt$...`-Hash in `.env` als `ADMIN_PASSWORD_HASH=` eintragen.

Dann:

```bash
npm start
```

Öffne `http://localhost:3000` und für den Upload-Bereich `http://localhost:3000/admin.html`.

## Was geschützt ist

- Es gibt **keinen Registrierungs-Endpunkt** und keinen User-Management-Bereich.
- Es gibt genau einen konfigurierten Admin-Account (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`).
- Passwort-Hashes werden mit Node.js `scrypt` erzeugt/geprüft; kein Klartext-Passwort wird gespeichert.
- Admin-Sessions sind zufällige, serverseitig gehaltene Tokens mit Ablaufzeit und HttpOnly/SameSite-Cookie.
- Schreibaktionen benötigen ein CSRF-Token.
- Login-Versuche werden pro IP begrenzt.
- Helmet setzt Security-Header inklusive CSP; Inline-Skripte sind nicht notwendig.
- Tool-Namen/Beschreibungen werden im Frontend mit `textContent` ausgegeben, nicht als HTML.
- Es werden nur ZIP-Dateien akzeptiert; Uploads liegen **außerhalb** des `public`-Ordners.
- ZIPs werden nie vom Server entpackt und niemals als HTML/JS ausgeliefert, sondern als Download mit `Content-Disposition: attachment` und `nosniff`.
- Dateinamen werden nicht als Pfad weiterverwendet; die gespeicherten Dateien bekommen zufällige UUID-Namen.
- Delete- und Upload-API sind serverseitig authentifiziert.
- Pro Tool können bis zu 4 Screenshots (PNG/JPG/WebP, 5 MB je Bild) hochgeladen werden.
- Screenshots werden außerhalb des `public`-Ordners gespeichert, per Magic-Byte geprüft und ausschließlich mit einem erlaubten Bild-MIME-Type ausgeliefert; SVG wird nicht akzeptiert.

## GitHub Pages Frontend

Bearbeite `public/config.js`:

```js
window.APP_CONFIG = Object.freeze({
  API_BASE: 'https://DEINE-API-DOMAIN.example'
});
```

Für eine getrennte Origin muss der API-Server `PUBLIC_ORIGIN` auf die **exakte** GitHub-Pages-Origin setzen. Außerdem müssen Cookies entsprechend konfiguriert werden, z. B. mit `COOKIE_SAME_SITE=none` und `COOKIE_SECURE=true` bei HTTPS.

Noch robuster ist ein Reverse Proxy / eine gemeinsame Domain, damit die API und die GitHub-Seite aus derselben Origin kommen.

## Deployment-Hinweise

Nutze bei Cloud-Hosting einen **persistenten Datenträger** für `uploads/` und `data/tools.json`. Bei rein ephemeralem Speicher gehen Uploads bei einem Neustart/Redeply verloren.

Setze in Produktion:

```env
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Und verwende HTTPS.

## Tool-Format

Admin lädt ein `.zip` hoch und kann zusätzlich bis zu 4 Screenshots hinzufügen. Die Website speichert Name, Kategorie, Beschreibung, Paket und Screenshot-Metadaten. Auf der öffentlichen Seite werden die Screenshots als sichere Vorschau angezeigt; das Tool-Paket bleibt ein ZIP-Download.

Wenn du später echte webbasierte Tools im Browser starten willst, sollte jedes Tool auf einer **separaten Origin/Subdomain** oder in einem bewusst sandboxed iframe laufen. Das verhindert, dass hochgeladener HTML/JS-Code denselben Origin wie das Admin-Panel bekommt.
