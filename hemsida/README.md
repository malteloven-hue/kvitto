# Malltjänsten – projektstruktur

Den här mappen är klar att deploya till Netlify. Du kan även köra lokalt med valfri statisk webbserver.

## Struktur

```
/index.html                 ← startsida/landing
/assets/
  site.css, site.js         ← global stil + logik
/templates/
  manifest.json             ← lista över mallar som ska visas i galleriet
  /faktura-a4/
    index.html              ← din uppladdade fakturamall (flyttad hit)
    styles.v3.css
    script.js
    logga.png               ← placeholder-logga (kan bytas)
    preview.jpg             ← bild som visas i galleriet
/builder/
  index.html, builder.css, builder.js  ← enkel “Skapa egen”‑byggare (exporterar ren HTML)
/netlify/
  /functions/
    scrape.js               ← Netlify Function för att hämta produktdata (om du använder den)
netlify.toml                ← pekar ut functions‑katalogen
```

## Lägg till en ny mall

1. Skapa en mapp i `/templates/<din-mall>/` med `index.html` + ev. CSS/JS.
2. Lägg en `preview.jpg` (1200×800 rekommenderat).
3. Lägg in en rad i `/templates/manifest.json`:
   ```json
   {
     "id": "min-mall",
     "name": "Min mall",
     "description": "Kort beskrivning.",
     "path": "/templates/min-mall/index.html",
     "preview": "/templates/min-mall/preview.jpg",
     "tags": ["tag1","tag2"]
   }
   ```

## Netlify

- Funktionen `/netlify/functions/scrape.js` blir tillgänglig på: `/.netlify/functions/scrape?url=https://...`
- `netlify.toml` är redan korrekt konfigurerad.

## Tips

- Behåll varje malls CSS/JS frikopplad från startsidan.
- Vill du sälja mallar? Lägg “låsta” mallar i manifestet men länka till en betal-/login-flöde först.
