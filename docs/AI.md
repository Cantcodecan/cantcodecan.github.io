# KI-Gegner · 4 Stufen

Datei `game/js/ai.js`, kein DOM. Nutzt nur `AW.rules`.

## Schnittstelle

```js
AW.ai.planTurn(state, level, opts?) -> action[]   // komplette Aktionsliste für den aktiven Spieler, endet mit {type:'end'}
// level: 'easy' | 'normal' | 'hard' | 'brutal'
// opts: { timeBudgetMs = 1500, rng = Math.random }
```
Die UI führt die Aktionen nacheinander mit Animation aus. `planTurn` arbeitet nur auf Kopien (`structuredClone`). Vor dem Aufruf zeigt die UI „KI denkt …“ an und ruft `planTurn` in `setTimeout(…, 30)` auf, damit die Anzeige erscheint.

## Benötigte Funktionen aus rules.js

`clone, reachable(state, unit) -> [{x,y,cost}], attackTargets(state, unit, x, y, moved) -> [unit], damage(state, att, def, attX, attY) -> dmg, apply(state, action), propertiesOf(state, p), isOver(state)`.

## Bausteine (alle Stufen)

**Wert einer Einheit:** `value(u) = cost(u) × hp/100`.

**Kandidaten pro Einheit:** Für jedes erreichbare Feld (inkl. Startfeld): *warten*, *einnehmen* (wenn möglich), *angreifen* für jedes Ziel (indirekt nur vom Startfeld).

**Aktionsbewertung `scoreAction(state, a, ctx)`:**
```
Angriff:  dealt = dmg/100 × cost(Ziel) × (Ziel nimmt gerade ein ? 1.5 : 1)
          kill  = (Ziel stirbt) ? 0.5 × value(Ziel) : 0
          taken = Gegenschaden/100 × cost(Angreifer)
          score = dealt + kill − taken × ctx.counterWeight
Einnahme: score = 1500 + (beendet Einnahme diesen Zug ? 2500 : 0) + (HQ ? 20000 : 0)
Warten:   score = − 120 × Distanz(Feld, nächstes Ziel)           // Ziel = gegn./neutrales Gebäude für Einnehmer, sonst nächste gegn. Einheit
                  + 40 × stars(Feld) × anzeigeHP/10
                  − ctx.threatWeight × threat[Feld] × value(u) / 10000
Alle:     − 3000, wenn das Feld eine eigene leere Fabrik/Flughafen blockiert
```
Distanz = Bewegungskosten-Distanz über `MOVE_COST` (einmal pro Zug je Bewegungsart per Dijkstra von den Zielen aus vorberechnen).

**Bedrohungskarte `threat[Feld]`:** Summe über alle gegnerischen Einheiten des maximalen Basisschadens, den sie im nächsten Zug auf dieses Feld anrichten könnten (Reichweite + Angriffsreichweite). Einmal pro Zug berechnen, nach Tötungen nur die betroffene Einheit abziehen. In der Wartebewertung wird sie mit `THREAT_SCALE = 10` multipliziert (Messung T06: ohne Faktor bleibt die Bedrohung gegenüber der Distanzstrafe wirkungslos).

**Bewertung eines Zustands `evaluate(state, p)`** (für Stufe Schwer und Sehr schwer):
```
  Σ value(eigene) − Σ value(gegnerische)
+ 1200 × (eigene Gebäude − gegnerische Gebäude)
+ 300  × Einnahmefortschritt (20 − cp) auf gegnerischen/neutralen Gebäuden durch eigene Einheiten (umgekehrt negativ)
+ 0.5  × (eigenes Geld − gegnerisches Geld)
− 40000, wenn ein Gegner das eigene HQ einnimmt und cp ≤ seine Anzeige-HP (Sieg im nächsten Zug)
+ 40000 im umgekehrten Fall;  ±1e6 bei Sieg oder Niederlage
− 0.3 × Σ threat[Feld eigener Einheit] × value / 10000
```

**Produktion `chooseBuilds(state, ctx)`:** Für jedes eigene leere Produktionsgebäude, die teuerste Option zuerst, wählen:
```
nutzen(typ) = Σ über gegnerische Einheiten e: (DAMAGE[typ][e.type] × value(e) − DAMAGE[e.type][typ] × cost(typ) × 0.6) / cost(typ)
```
Infanterie bekommt +50 % Bonus, solange neutrale oder gegnerische Städte erreichbar sind und weniger als 3 eigene Einnehmer existieren. Gebaut wird, solange Geld reicht. Ein Rest von 1000 bleibt, wenn eigene Einheiten Heilung brauchen.

## Die Stufen

### Leicht (`easy`)
- Einheiten in Zufallsreihenfolge, `counterWeight` 0, `threatWeight` 0.
- Pro Einheit: Score × (0.5 + rng()), beste Aktion nehmen. In 25 % der Fälle die zweitbeste.
- Bauen: zufällige bezahlbare Einheit, maximal 2 pro Zug.
- Kraft: nur mit 50 % Wahrscheinlichkeit nutzen, wenn verfügbar.

### Mittel (`normal`)
- Reihenfolge: indirekte zuerst, dann nach Kosten absteigend. `counterWeight` 1, `threatWeight` 0.5.
- Pro Einheit die beste Aktion, auf dem simulierten Zustand ausgeführt, damit spätere Einheiten den neuen Stand sehen.
- Bauen: `chooseBuilds`. Kraft: sofort nutzen, wenn verfügbar.

### Schwer (`hard`)
- `counterWeight` 1.2, `threatWeight` 1.
- **Globale Gier:** Wiederholen, bis alle Einheiten gehandelt haben: für jede noch freie Einheit die beste Aktion auf dem aktuellen Simulationszustand bewerten, die global beste ausführen. Ergebnis: Fokusfeuer und die richtige Reihenfolge ergeben sich von selbst.
- **Rückzug:** Einheit mit Anzeige-HP ≤ 3, bedrohtem Feld und erreichbarem eigenen Heilgebäude: Warten auf diesem Gebäude bekommt +2000.
- **HQ-Schutz:** Gegnerischer Einnehmer ≤ 2 Züge vom eigenen HQ entfernt: Angriffe auf ihn ×3, Blockieren des HQ-Felds +5000.
- **Kraft:** Plan einmal mit und einmal ohne Kraft berechnen und den Plan mit höherem `evaluate` wählen.
- Bauen nach dem Bewegen (damit Fabriken frei sind), `chooseBuilds`.

### Sehr schwer (`brutal`) – bewusst schwer zu schlagen
- Alles aus Schwer, plus **Beam-Search über den ganzen Zug**:
  1. Zustand = (Simulation, verbleibende Einheiten). Pro Schritt für jeden Zustand im Strahl die **3 besten** Aktionen der globalen Gier erzeugen.
  2. Neue Zustände mit `evaluate` bewerten, die **besten 8** behalten (Strahlbreite B = 8). Zustände mit gleicher Einheitenposition zusammenfassen.
  3. Ende, wenn alle Einheiten gehandelt haben. Dann je Endzustand `chooseBuilds` ausführen.
  4. **Gegenzug-Check:** Für die besten 4 Endzustände den Gegnerzug mit der Stufe *Mittel* simulieren und danach `evaluate` neu berechnen. Den Plan mit dem besten Wert nach dem Gegenzug wählen.
  5. **Zeitbudget:** `timeBudgetMs`. Wird es knapp, zuerst Schritt 4 weglassen, dann B auf 4 senken. Immer den besten bisher gefundenen Plan zurückgeben.
- Kraft wie Schwer, aber im Beam als zusätzliche Startvariante.
- Einkommensbonus `incomeMul` 1.1 (in `data.js`). Er wird im Menü offen angezeigt. Erst wenn Testspiele zeigen, dass die Stufe zu leicht ist, Strahlbreite und Gegenzug-Check vor dem Bonus erhöhen.

## Leistung

- Karten ≤ 16×11 Felder, ≤ 30 Einheiten je Seite.
- `reachable` mit Wiederverwendung von Arrays und `Int16Array` für Kosten. Kein `structuredClone` innerhalb der Kandidatenbewertung: Angriffe und Bewegungen werden rechnerisch bewertet, geklont wird nur beim Ausführen einer gewählten Aktion.
- Ziel: Mittel < 100 ms, Schwer < 500 ms, Sehr schwer ≤ 1500 ms pro Zug auf einem durchschnittlichen Laptop.

## Abnahme (Self-Play, `node game/test/selfplay.js`)

Auf allen Karten, beide Seiten abwechselnd, je 10 Partien:
- Mittel schlägt Leicht in ≥ 90 %
- Schwer schlägt Mittel in ≥ 80 %
- Sehr schwer schlägt Schwer in ≥ 75 %
- Keine Partie stürzt ab, keine endet ohne Ergebnis vor `dayLimit`. Die Zeit pro Zug wird ausgegeben.
