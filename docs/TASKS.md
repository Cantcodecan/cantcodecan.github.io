# Arbeitspakete

## Regeln für das umsetzende Modell (verbindlich)

1. Nimm das erste Paket mit `[ ]`. Lies **nur** die dort genannten Dateien und Doku-Abschnitte.
2. Ändere bestehende Dateien mit gezielten Edits, nicht durch Neuschreiben ganzer Dateien. Neue Dateien in einem Stück schreiben.
3. Werte nie im Code wiederholen. Immer aus `AW.UNITS`, `AW.DAMAGE` usw. lesen.
4. Führe den Test des Pakets aus. Er muss grün sein. `node game/test/data.test.js` muss immer grün bleiben.
5. Hake das Paket hier mit `[x]` ab, committe (`T0X: <Kurzbeschreibung>`) und pushe auf den aktuellen Branch.
6. Antworte im Chat in 1–3 Zeilen. Keine Code-Auszüge, keine Zusammenfassung der Doku.
7. Bei 🧠 markierten Paketen: erst kurz planen, dann umsetzen. Alle anderen direkt umsetzen.
8. Wenn ein Paket unklar ist, triff die einfachste Annahme, die zur Doku passt, und vermerke sie in einer Zeile unter dem Paket.

Nach jedem Paket ist das Spiel öffnungsfähig (`game/index.html`). Der alte Prototyp in `game/index.html` wird in T05 ersetzt.

---

- [x] **T00 Daten und Karten** – `js/data.js`, `js/missions.js`, `test/data.test.js` (von Opus erstellt)

- [x] **T01 Regeln: Zustand, Bewegung, Kampf** 🧠
  - Lesen: DESIGN.md §2–4, §10 · `js/data.js`
  - Neu: `game/js/rules.js` → `AW.rules = { newGame, clone, unitAt, tileAt, reachable, attackTargets, damage, previewAttack, apply, isOver }`
    - `newGame(mapDef, opts)`: opts `{ co:[a,b], ai:[null|level, …], difficulty }`, baut `state` aus `map`/`units`/`funds`/`objective`/`build`. `hp` 100, `acted` false.
    - `reachable(state, unit)` → `[{x,y,cost}]` (Dijkstra, CO-`moveBonus` bei aktiver Kraft)
    - `attackTargets(state, unit, x, y, moved)` → gegnerische Einheiten (indirekt nur wenn `!moved`)
    - `damage(state, att, def, attX, attY)` → dmg nach Formel §4 (Sterne vom Feld des Verteidigers)
    - `previewAttack(state, id, x, y, targetId)` → `{ dmg, counter }`, ohne Zustand zu ändern
    - `apply(state, {type:'move', …, then:'wait'|{attack:id}})`. Das Paket deckt `move`+`wait`/`attack` ab, inkl. Gegenangriff, Tod, Ladeleiste (§6).
  - Neu: `game/test/rules.test.js` mit mindestens: Kosten Wald/Gebirge je Bewegungsart, Blockade durch Gegner, Durchzug durch eigene, Indirekte feuern nicht nach Bewegung, Formel-Stichprobe (Panzer 10 HP greift Infanterie 10 HP auf Wald an: floor(75×1×(100−20)/100) = 60), Gegenangriff mit reduzierten HP.
  - Test: `node game/test/rules.test.js`

- [x] **T02 Regeln: Wirtschaft, Einnahme, Rundenwechsel, Sieg, Kräfte**
  - Lesen: DESIGN.md §2, §5–7 · `js/rules.js`
  - In `rules.js` ergänzen: `apply` für `then:'capture'`, `build`, `power`, `end` (Rundenbeginn: Einkommen inkl. `incomeMul` nur für KI-Spieler, Heilen, Reset), `propertiesOf(state,p)`, `buildOptions(state,x,y)` (mit `costMod`), `isOver` (rout, survive, dayLimit → setzt `state.winner`).
  - Tests ergänzen: Einnahme mit 10 HP in 2 Zügen, Reset bei Verlassen, Einkommen, Heilen mit Kosten, Bauen nur auf freier eigener Fabrik, HQ-Einnahme beendet Spiel, survive nach N Tagen, Kraft-Aktivierung setzt Ladung auf 0.
  - Test: `node game/test/rules.test.js`
  - Annahmen: `winner` = 0 | 1 | `'draw'`; `isOver` prüft und setzt es (auch von `apply` aufgerufen); Rout ohne Einheiten: Gegner ab Tag 2 oder sofort ohne baubare Einheit, aktiver Spieler nur ohne baubare Einheit.

- [x] **T03 Piktogramme: Gelände und Gebäude**
  - Annahme: Brücken (Straße über Fluss) nicht gesondert gezeichnet; Platzhalter-`unit`/`portrait` bis T04.
  - Lesen: ART.md komplett (ohne Einheiten und Porträts)
  - Neu: `game/js/icons.js` → `AW.icons = { terrain, unit, portrait }`. `unit` und `portrait` vorerst als einfache Platzhalter (Kreis in Teamfarbe mit Kürzel bzw. Initialen).
  - Neu: `game/icons-preview.html`: zeigt alle Geländearten × Besitzer und Straßen/Flüsse mit allen 16 Masken in einem Raster (48 px und 28 px).
  - Test: `node -e "require('./game/js/data.js');require('./game/js/icons.js');for(const t in AW.TERRAIN)for(const o of [null,0,1])if(!AW.icons.terrain(t,o,0,0,5).includes('<'))throw t"`

- [x] **T04 Piktogramme: Einheiten und Porträts**
  - Lesen: ART.md (Stil, Einheiten, Porträts) · `js/icons.js`
  - In `icons.js`: `unit` und `portrait` voll umsetzen. Vorschau-Seite um alle Einheiten × Teams auf 3 Geländearten und um die Porträts ergänzen.
  - Test: wie T03 sinngemäß für alle `AW.UNITS` × [0,1] und alle `AW.COMMANDERS`. Silhouette-Test aus ART.md per Augenschein in der Vorschau.

- [x] **T05 Spielfeld und Bedienung (Hot-Seat spielbar)** 🧠
  - Annahme: `ai.js` wird erst in T06 in `index.html` eingebunden; Bewegung wird erst mit der Aktion an `rules.apply` übergeben (Abbrechen = Einheit springt zurück).
  - Lesen: DESIGN.md §2–5, §10 · ART.md (HP-Anzeige, Fertig-Filter) · Schnittstellen von `rules.js` (nur Exporte überfliegen)
  - Neu: `game/css/style.css`, `game/js/render.js`, `game/js/ui.js`. `game/index.html` ersetzen (lädt data, missions, rules, ai (falls vorhanden), icons, render, ui).
  - Muss können: Karte responsiv (Kachel `clamp(28px, 6vw, 56px)`, Karte horizontal scrollbar statt Seite), Einheit wählen → Reichweite blau, Angriffsfelder rot, Pfadvorschau, Aktionsmenü (Angreifen/Einnehmen/Warten/Abbrechen), Schadensvorschau beim Zielen, Rechtsklick/Escape bricht ab. Seitenleiste oder Kopfzeile: Tag, aktiver Spieler, Geld, CO, Ladeleiste mit Kraft-Knopf. Geländeinfo bei Tippen auf ein leeres Feld (Name, Sterne). Einheiteninfo (Name, HP, Bewegung, Reichweite, `desc`). Baumenü bei Klick auf eigene freie Fabrik bzw. Flughafen. Gewinner-Bildschirm.
  - Bewegung animiert (Einheit gleitet über den Pfad, 60 ms pro Feld), Treffer kurz weiß aufblitzen, Schadenszahl schwebt hoch.
  - Startet vorerst direkt in `AW.SKIRMISH[0]`, Hot-Seat (beide Menschen).
  - Test: Im Browser eine Partie Hot-Seat bis zur HQ-Einnahme spielen. Keine Konsolenfehler. Playwright-Smoke-Test `game/test/smoke.js` (Seite laden, auf eine Einheit und ein Feld klicken, Zug beenden, keine `pageerror`).

- [x] **T06 KI: Bausteine, Leicht, Mittel**
  - Annahmen: Schwer/Sehr schwer nutzen bis T07/T08 die Mittel-Logik. Selfplay spiegelt die Karten (Azur-Hälfte, gleiche Armee/Geld/CO), da Kampagnenkarten asymmetrisch sind; `m1` (Erstschlag der Panzer entscheidet, ~50 % für jede Stufe) wird angezeigt, aber nicht gewertet. Bedrohung wird mit `THREAT_SCALE` 10 skaliert (siehe AI.md). Bauen: Einnehmer bis 3, sonst teuerste Einheit mit positivem Nutzen. UI: `?ai=<stufe>` macht Karmin zur KI (bis T09-Menü). Ergebnis: `normal easy 10` = 97 %.
  - Lesen: AI.md (Schnittstelle, Bausteine, Leicht, Mittel, Leistung) · Exporte von `rules.js`
  - Neu: `game/js/ai.js` → `AW.ai = { planTurn }` plus interne `scoreAction`, `threatMap`, `distanceMaps`, `chooseBuilds`, `evaluate`.
  - UI: Ist der aktive Spieler eine KI, „KI denkt …“ anzeigen, Plan holen, Aktionen mit Animation abspielen (Eingaben gesperrt).
  - Neu: `game/test/selfplay.js` (Argumente: `levelA levelB games`). Spielt auf allen Karten, Seiten wechseln, gibt Siegquote und ms/Zug aus.
  - Test: `node game/test/selfplay.js normal easy 10` → Mittel ≥ 90 %.

- [x] **T07 KI: Schwer** 🧠
  - Annahmen: Schwer-Plan wird je mit und ohne Kraft per `evaluate` verglichen (vor „Bauen“-Ende, vor `end`); Bedrohungskarte wird nach Tötungen neu berechnet; Rückzug-Bonus nur auf eigenen Gebäuden bei bedrohtem Startfeld. Ergebnis: `hard normal 10` = 92 %, 3 ms/Zug.
  - Lesen: AI.md (Schwer) · `js/ai.js`
  - Test: `node game/test/selfplay.js hard normal 10` → ≥ 80 %, < 500 ms/Zug.

- [ ] **T08 KI: Sehr schwer** 🧠
  - Lesen: AI.md (Sehr schwer, Leistung, Abnahme) · `js/ai.js`
  - Test: `node game/test/selfplay.js brutal hard 10` → ≥ 75 %, ≤ 1500 ms/Zug. Wird die Quote nicht erreicht: zuerst `evaluate`-Gewichte, Strahlbreite und Kandidaten pro Schritt anpassen, Werte in AI.md nachtragen.

- [ ] **T09 Menüs, Kampagne, Story**
  - Lesen: DESIGN.md §1, §7, §9 · `js/missions.js` (nur Struktur) · `js/ui.js`
  - Hauptmenü (Kampagne / Gefecht / Hot-Seat / Regeln), Kampagnenauswahl mit Freischaltung (`localStorage` in try/catch), Schwierigkeitsauswahl mit Beschreibung (Sehr schwer: „+10 % Einkommen“), Gefecht-Einstellungen (Karte, COs, KI-Stufe, Startgeld), Dialogbox mit Porträt für `intro`/`outro`, Missionsziel-Anzeige (bei survive: „Tag X / N“), Kurzregeln-Seite mit Schadens-Übersicht aus `AW.DAMAGE` (Tabelle mit Farbskala).
  - Test: Kampagne M1 im Browser starten, Dialog durchklicken, gewinnen, M2 ist freigeschaltet. Smoke-Test erweitern.

- [ ] **T10 Feinschliff und Mobil**
  - Lesen: `css/style.css`, `js/render.js`, `js/ui.js`
  - Touch: Tippen = Klick, langes Tippen = Info. Knopf „Rückgängig“ für die letzte Bewegung ohne Aktion. Optionale Kurz-Animationen (Einstellung „schnell“). Bestätigung vor „Zug beenden“, wenn noch Einheiten frei sind. Hell/dunkel-Darstellung des Rahmens (`prefers-color-scheme`). Kein horizontales Seitenscrollen bei 360 px Breite.
  - Test: Playwright-Screenshot bei 360×740 und 1280×800, Smoke-Test grün.

- [ ] **T11 Balancing-Lauf** 🧠
  - Lesen: AI.md (Abnahme) · DESIGN.md §8
  - `selfplay.js` um Statistik erweitern: gebaute Einheiten je Typ, Siegquote je Seite und Karte. Wenn eine Seite einer Karte > 70 % gewinnt (gleiche Stufe), die Karte in `missions.js` anpassen (Startgeld oder Gebäude). Wenn ein Einheitentyp nie oder immer gebaut wird, `cost` in `data.js` um höchstens ±15 % ändern. Jede Änderung als Zeile in DESIGN.md §8 dokumentieren.
  - Test: alle Tests und alle Abnahmen aus AI.md grün.

## Später (nicht jetzt umsetzen)

Nebel des Krieges, Seeeinheiten (Transport, Kanonenboot), Wetter, Karteneditor, Online-Mehrspieler, generierte Bild-Assets statt SVG.
