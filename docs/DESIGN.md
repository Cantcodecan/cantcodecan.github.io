# Miniwars – Die Valdur-Krise · Spieldesign

Werte stehen nur in `game/js/data.js`, Karten und Dialoge nur in `game/js/missions.js`. Dieses Dokument erklärt die Regeln; bei Widerspruch gelten die Daten.

## 1. Story

**Welt:** Der Valdur-Archipel. Unter der Vulkaninsel Ascha liegt die **Glutquelle**, eine uralte geothermische Energiequelle, die alle Inseln mit Strom versorgt.

**Fraktionen**
- **Azur-Bund** (Blau, Spieler): ein loser Bund freier Inselstädte, wenige Soldaten, viel Erfindungsgeist.
- **Karmin-Hegemonie** (Rot, Gegner): ein Militärstaat im Norden, der die Glutquelle für sich beansprucht.

**Kommandanten (COs)**
- **Mira Falk** (Azur): junge Küstenkommandantin, ausgewogen, führt die Gegenoffensive.
- **Tarek Hale** (Azur): alter Artillerie-Oberst, ruhig, trocken, Meister des indirekten Feuers.
- **Marschall Varek** (Karmin): Panzergeneral, stolz und hart, aber mit Ehrgefühl.
- **Sel** (Karmin): Chefingenieurin der Hegemonie, kühl und brillant, die eigentliche Drahtzieherin.

**Handlung:** Karmin überfällt den Süden (M1). Azur hält eine Panzerkolonne im Wald auf (M2), Tarek stößt dazu und erobert den Fluss zurück (M3). In Erzheim fällt Karmins Rüstungszentrum (M4). Der geschlagene Varek enthüllt: Sel will die Glutquelle überladen und als Waffe zünden. Das würde Inseln versenken. Azur kämpft sich über Ascha (M5) bis zur Quelle vor und stoppt Sel (M6). Varek wechselt am Ende auf die Seite des Friedens.

Missionen, Ziele und Dialoge: `AW.MISSIONS`. Dialoge erscheinen als Textbox mit Porträt (Piktogramm des COs, siehe ART.md) vor und nach der Mission.

## 2. Spielablauf

- Quadratisches Raster, 2 Spieler (Azur = 0, Karmin = 1). Ein **Tag** = Zug Azur + Zug Karmin.
- **Rundenbeginn** des aktiven Spielers, in dieser Reihenfolge:
  1. Einkommen: `incomePerProperty` × eigene Gebäude × `incomeMul` (KI-Stufe, nur für die KI).
  2. Heilen: Jede eigene Einheit auf eigenem passendem Gebäude erhält `healHp` (max. 100) und kostet `healCostFactor` × Einheitenkosten je 10 HP. Ist das Geld zu knapp, wird nicht geheilt. Passend: Stadt, Fabrik und HQ heilen Bodeneinheiten, Flughafen heilt Lufteinheiten.
  3. Alle Einheiten werden wieder aktiv.
- **Einheit handeln:** wählen → Zielfeld in Reichweite wählen (oder stehen bleiben) → Aktion: *Angreifen*, *Einnehmen* oder *Warten*. Vor der Aktion kann die Bewegung abgebrochen werden. Danach ist die Einheit für den Tag fertig.
- **Bauen:** Eigene leere Fabrik baut Bodeneinheiten, eigener leerer Flughafen baut Lufteinheiten (`BUILD_LISTS`, eingeschränkt durch `mission.build`). Neue Einheiten sind erst am nächsten Tag aktiv. Kosten werden um `costMod` des COs angepasst.
- **Zug beenden:** Der Gegner ist am Zug.

## 3. Bewegung

- Reichweite = Bewegungspunkte (`move` + CO-Boni). Kosten je Feld aus `MOVE_COST[moveType][terrain]`, fehlender Eintrag = unpassierbar. Berechnung per Dijkstra über 4 Nachbarn.
- Durch eigene Einheiten darf man ziehen, durch gegnerische nicht. Das Zielfeld muss leer sein (außer dem Startfeld).
- Straßen über Flüsse sind Brücken (normales Straßenfeld).

## 4. Kampf

- HP intern 0–100, angezeigt als `ceil(hp/10)` (1–10).
- **Direkt** (`minRange` 1): Angriff auf Nachbarfelder nach Bewegung.
- **Indirekt** (`minRange` > 1): Angriff nur ohne Bewegung in diesem Zug, Distanz (Manhattan) im Bereich `[minRange, maxRange]` (+ CO-Reichweitenbonus).
- Angriff nur, wenn `DAMAGE[angreifer][ziel]` existiert.
- **Schadensformel** (deterministisch, kein Zufall):
  ```
  atkBonus = Summe der passenden CO-Boni in %   (passiv + aktive Kraft)
  stars    = Verteidigungssterne des Zielfelds, 0 wenn Ziel domain 'air'
  dmg = floor( base × (100 + atkBonus)/100 × anzeigeHP(Angreifer)/10 × (100 − stars × anzeigeHP(Ziel)) / 100 )
  ```
  `dmg` ist mindestens 0 und wird von den internen HP des Ziels abgezogen. Bei HP ≤ 0 wird die Einheit entfernt.
- **Gegenangriff:** Überlebt das Ziel, ist es eine direkte Einheit, steht es neben dem Angreifer und hat es einen `DAMAGE`-Eintrag gegen den Angreifer, schlägt es mit seinen neuen HP nach derselben Formel zurück.
- **CO-Bonusgruppen:** `all`, `direct` (minRange 1), `indirect`, `directGround` (direkt und domain ground), `air` (domain air).
- **Schadensvorschau:** Vor dem Bestätigen eines Angriffs zeigt die UI den erwarteten Schaden und Gegenschaden an.

## 5. Gebäude und Wirtschaft

- Gebäude: Stadt, Fabrik, Flughafen, HQ. Jedes hat `capturePoints` = 20.
- **Einnehmen** (nur Einheiten mit `capture`): senkt die Punkte um die Anzeige-HP. Bei ≤ 0 wechselt der Besitzer und die Punkte springen auf 20 zurück. Verlässt die Einheit das Feld oder stirbt sie, springen die Punkte auf 20 zurück.
- Neutrale Gebäude bringen kein Geld.

## 6. Kommandanten-Kräfte

- Ladeleiste: Der Angreifer erhält 50 % des verursachten Schadenswerts, der Getroffene 100 % des erlittenen Schadenswerts. Schadenswert = `dmg/100 × Kosten des Ziels`. Gegenangriffe zählen genauso.
- Kraft verfügbar, wenn Ladung ≥ `power.stars × POWER_STAR`. Aktivieren zu Beginn oder während des eigenen Zuges. Danach ist die Ladung 0 und die Kraft wirkt bis Zugende.
- Kraft-Effekte: `heal` (sofort, ohne Kosten, max. 100), `atk`, `moveBonus`, `rangeBonus` (nur Maximalreichweite). Gruppen wie in Abschnitt 4.

## 7. Siegbedingungen

- `rout`: Gegnerisches HQ eingenommen **oder** der Gegner hat keine Einheiten mehr (geprüft ab Tag 2, oder sofort, wenn er sie im Kampf verliert und kein Geld und keine Fabrik mehr hat).
- `survive`: Azur gewinnt nach Ablauf von `days` Tagen, wenn das eigene HQ noch gehalten wird. Rout-Regeln gelten für beide Seiten weiter.
- Tageslimit `dayLimit`: Danach gewinnt, wer mehr Gebäude besitzt (bei Gleichstand unentschieden).

## 8. Einheiten-Balance (Kurzüberblick)

Stein-Schere-Papier wie in Advance Wars. Die genauen Werte stehen in `UNITS`/`DAMAGE`.

| Einheit | stark gegen | schwach gegen |
|---|---|---|
| Infanterie | nichts; billig, nimmt ein, blockt | alles Gepanzerte, Flak, Artillerie |
| Grenadier | Panzer, Späher, Artillerie | Infanterie in Masse, Schwere Panzer, Hubschrauber |
| Späher | Infanterie, Artillerie | Panzer aller Art, Grenadiere |
| Panzer | Späher, Infanterie, Indirekte | Schwerer Panzer, Grenadier, Bomber |
| Schwerer Panzer | alles am Boden | Bomber, Raketen, Grenadiere (in Masse), Preis |
| Artillerie | alles am Boden (ohne Gegenschlag) | Nahkampf, Luft, Bewegung |
| Raketenwerfer | alles am Boden aus großer Ferne | Nahkampf, Luft, Preis |
| Flak | Luft, Infanterie | Panzer, Artillerie |
| Kampfhubschrauber | Bodeneinheiten außer Flak | Flak, Jäger |
| Jäger | Hubschrauber, Bomber | kann Boden nicht angreifen |
| Bomber | alles am Boden | Flak, Jäger, kann Luft nicht angreifen |

**Balancing-Lauf (T11, `node game/test/selfplay.js normal normal 20`):** Gespiegelte Karten, gleiche Stufe: Seite 0 (Anzugsrecht) gewinnt auf m2, m5, m6, s1 immer, Seite 1 auf m3, m4 – der Verlauf ist bei festem KI-Zufall je Karte identisch, also Anzugsvorteil, kein Kartenfehler. Echte Karten sind asymmetrisch gewollt; keine Kartenänderung. Gebaut (120 Partien): inf 920, mech 2280, recon 120, tank 1160, heavy 20, art 380, rocket 0, aa 500, heli 680, fighter 0, bomber 0. Rocket/Fighter/Bomber/Heavy sind bei Startgeld 3000–5000 und 1000/Gebäude kaum bezahlbar, die Partien enden vorher; Test mit −15 % Kosten (Rocket 12750, Jäger 17000, Bomber 18700) änderte nichts → `cost` unverändert.

## 9. Spielmodi

- **Kampagne:** M1–M6 nacheinander freigeschaltet. Fortschritt in `localStorage` (in try/catch). Schwierigkeit wählbar vor jeder Mission.
- **Gefecht:** Karte (alle Missionskarten + `AW.SKIRMISH`), CO je Seite, KI-Stufe, Startgeld wählbar.
- **Hot-Seat:** 2 Menschen an einem Gerät.

## 10. Technik

- Kein Build, keine Abhängigkeiten. Klassische `<script>`-Dateien, jede hängt sich an `globalThis.AW` (wie `data.js`). Funktioniert per `file://`, GitHub Pages und in Node (`require`).
- Dateien:

| Datei | Inhalt | DOM? |
|---|---|---|
| `js/data.js` | Werte (fertig) | nein |
| `js/missions.js` | Karten, Story (fertig) | nein |
| `js/rules.js` | Zustand und Regeln, reine Funktionen | nein |
| `js/ai.js` | KI, siehe AI.md | nein |
| `js/icons.js` | SVG-Strings, siehe ART.md | nein |
| `js/render.js` | Spielfeld zeichnen, Animationen | ja |
| `js/ui.js` | Menüs, Dialoge, Eingabe, Spielsteuerung | ja |
| `css/style.css` | Styles | – |
| `index.html` | lädt alle Skripte in obiger Reihenfolge | – |
| `test/*.test.js` | Node-Tests mit `assert` | nein |

- **Zustand** (reines JSON, per `structuredClone` kopierbar):
  ```js
  state = {
    w, h, day, turn,                // turn = aktiver Spieler 0|1
    tiles: [{ terrain, owner, cp }], // Index y*w+x, cp = Einnahmepunkte
    units: [{ id, type, owner, x, y, hp, acted, moved }],
    players: [{ funds, co, charge, powerActive, ai: null|'easy'|'normal'|'hard'|'brutal' }],
    objective, build, nextId, winner: null|0|1|'draw'
  }
  ```
- **Aktionen** (von UI und KI gleich verwendet, `rules.apply(state, action)` verändert den Zustand):
  ```js
  { type: 'move', id, x, y, then: 'wait' | 'capture' | { attack: targetId } }
  { type: 'build', x, y, unit }
  { type: 'power' }
  { type: 'end' }
  ```
