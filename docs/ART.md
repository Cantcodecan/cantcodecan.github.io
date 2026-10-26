# Piktogramme · Stilregeln

Alle Grafiken sind SVG-Strings in `game/js/icons.js`. Später können sie durch Bilddateien ersetzt werden, ohne dass sich die Schnittstelle ändert.

## Schnittstelle

```js
AW.icons.terrain(terrain, owner, x, y, mask)  // -> SVG-Inhalt (ohne <svg>), viewBox 0 0 48 48
AW.icons.unit(type, owner)              // -> SVG-Inhalt, Blick nach rechts; Karmin wird gespiegelt
AW.icons.portrait(coId)                 // -> SVG-Inhalt, viewBox 0 0 64 64
```
`x, y` dienen nur für Variation (z. B. `(x*7+y*13)%3` wählt eine von 3 Baum- oder Wellen-Anordnungen), damit große Flächen nicht gekachelt wirken.

## Stil (Mischung aus Advance Wars und Polytopia)

- **Flach, kräftig, leicht kindlich:** klare Formen, keine Verläufe. Ein Schatten- und ein Lichtton je Fläche (Low-Poly-Facetten wie bei Polytopia).
- **Umriss:** `#1d2330`, `stroke-width` 2 bei Einheiten, 1.5 bei Gebäuden, keine Umrisse bei Bodengelände.
- **Einheiten:** Seitenansicht wie in Advance Wars, füllen ca. 36×30 px der 48er-Box, unten bündig bei y≈42. Ein weicher Bodenschatten: Ellipse `rx 16 ry 3` bei y 43, `#000` mit opacity .25.
- **Teamfarben** aus `AW.FACTIONS`: `color` für Hauptflächen, `dark` für Schattenseiten und Ketten, `light` für Lichtkanten. Neutral: `#c9c2b2` / `#8d8676` / `#ece6d6`.
- **Neutrale Teile:** Metall `#5d6b78`, Metall hell `#8a99a8`, Haut `#f1c9a5`, Glas `#bfe6ff`.
- **Karmin:** `<g transform="translate(48 0) scale(-1 1)">` um die Einheit, damit sie nach links blickt.
- **Geländepalette:**

| Gelände | Grund | Akzent |
|---|---|---|
| Ebene | `#9bd16f` | Grasbüschel `#7fb957` |
| Straße | Ebene + Band `#d9cfb4`, Rand `#b8ad90` | Mittellinie gestrichelt `#efe8d2` |
| Wald | `#7fb957` | 2–3 Nadelbäume, Dreiecke `#3f7a31`/`#2f6325`, Stamm `#6b4a2b` |
| Gebirge | `#9bd16f` | 1–2 Berge, Facetten `#8d96a0`/`#6f7882`, Schneekappe `#f4f7fa` |
| Fluss | `#9bd16f` | gewundenes Band `#5aa7e0`, Lichtlinie `#a8dcfa` |
| Meer | `#4a90c9` | 2 Wellenlinien `#8cc7ef` |

- **Straßen und Flüsse verbinden sich:** `terrain()` braucht die Nachbarn. Darum bekommt `render.js` eine Funktion `neighborMask(state, x, y, terrain)` (Bits: oben 1, rechts 2, unten 4, links 8), die an `AW.icons.terrain(..., mask)` als 5. Parameter geht. Das Band läuft von der Mitte zu jedem gesetzten Rand. Brücken (Straße mit Fluss-Nachbarn oben und unten bzw. links und rechts) bekommen Holzgeländer `#8a5a32`.

## Gebäude (auf Ebene-Grund, Teamfarbe = Besitzer)

- **Stadt:** zwei Häuser mit Satteldach. Dach in Teamfarbe, Wände `#ece6d6`, Fenster `#5d6b78`.
- **Fabrik:** breite Halle mit Sägezahndach in Teamfarbe, Schornstein mit grauer Rauchwolke (2 Kreise), Tor dunkel.
- **Flughafen:** Rollbahn (graues Band mit weißen Strichen), kleiner Tower mit Glaskanzel, Windsack in Teamfarbe.
- **HQ:** Festung mit zwei Türmen und Zinnen, große Fahne in Teamfarbe mit Fraktionsemblem (Azur: weiße Welle, Karmin: weißer Stern mit 5 Zacken).
- **Einnahme läuft:** kleine Zahl `cp` oben links in weißem Kreis.

## Einheiten (alle mit Teamfarbe als Hauptfläche)

| Einheit | Motiv |
|---|---|
| Infanterie | 2 kleine Soldaten hintereinander, Helm in Teamfarbe, Gewehr schräg, der hintere etwas versetzt und dunkler |
| Grenadier | 1 kräftiger Soldat mit großer Panzerfaust (Rohr `#5d6b78`, Spitze teamfarben) auf der Schulter, Rucksack |
| Späher | Geländewagen mit 4 Rädern (2 sichtbar, `#1d2330`, Felge `#8a99a8`), offenes Verdeck, kleines MG |
| Panzer | Wanne mit Kette (Rechteck mit runden Enden, `dark`, 4 Laufrollen), runder Turm, mittellanges Rohr |
| Schwerer Panzer | wie Panzer, aber höher und breiter, kantiger Turm, sehr langes, dickes Rohr, Schürzen über der Kette |
| Artillerie | Kettenfahrzeug mit offenem Geschütz, Rohr steil im 45°-Winkel nach oben |
| Raketenwerfer | LKW mit 3 Achsen, Startgestell mit 3 Raketen (weiß, Spitzen teamfarben) schräg nach oben |
| Flak | Kettenfahrzeug mit Doppelrohr steil nach oben, Radarschüssel |
| Kampfhubschrauber | Rumpf tropfenförmig, Glaskanzel, Rotor als lange flache Ellipse, Heckrotor, Kufen; schwebt (Schatten kleiner, y 44) |
| Jäger | schlanker Pfeil-Jet von der Seite, Delta-Flügel, Glaskanzel, Nachbrenner-Flamme `#ffb547` |
| Bomber | breiter Rumpf, gerade Flügel mit 2 Triebwerken, Bombenschacht-Klappe, wirkt schwer |

- **HP-Anzeige:** bei < 10 weiße Zahl in dunklem Kreis unten rechts (zeichnet `render.js`, nicht das Icon).
- **Fertig gezogen:** `render.js` legt `filter: grayscale(.6) brightness(.8)` auf die Einheit.

## Porträts (64×64, Brustbild in Polytopia-Flachstil)

| CO | Merkmale |
|---|---|
| Mira Falk | kurzes rotbraunes Haar, blaue Uniform, Fliegerbrille auf der Stirn, entschlossener Blick |
| Tarek Hale | graues Haar, grauer Schnurrbart, Schirmmütze, blaue Uniform mit Orden |
| Marschall Varek | kantiges Kinn, Narbe, rote Uniform mit Epauletten, Schirmmütze mit Stern |
| Sel | schwarzer Bob, schmale Brille mit Lichtreflex, dunkelroter Laborkittel über Uniform, leichtes Lächeln |

## Qualitätskriterien

- Jede Einheit ist bei 28 px Kachelgröße eindeutig von den anderen unterscheidbar (Silhouette-Test: Umriss allein reicht).
- Blau und Rot sind auf jedem Gelände gut erkennbar.
- Kein Element ragt aus der 48er-Box.
