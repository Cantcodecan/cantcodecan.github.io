// Spieldaten – einzige Quelle der Wahrheit für Werte. Regeln dazu: docs/DESIGN.md
// Lädt im Browser (<script>) und in Node (require) gleichermaßen: alles hängt an globalThis.AW.
(function (g) {
  const AW = (g.AW = g.AW || {});

  // def = Verteidigungssterne (je Stern -1 % Schaden pro Anzeige-HP des Verteidigers)
  AW.TERRAIN = {
    plain:    { name: 'Ebene',    def: 1 },
    road:     { name: 'Straße',   def: 0 },
    forest:   { name: 'Wald',     def: 2 },
    mountain: { name: 'Gebirge',  def: 4 },
    river:    { name: 'Fluss',    def: 0 },
    sea:      { name: 'Meer',     def: 0 },
    city:     { name: 'Stadt',    def: 3, property: true },
    factory:  { name: 'Fabrik',   def: 3, property: true, builds: 'ground' },
    airport:  { name: 'Flughafen', def: 3, property: true, builds: 'air' },
    hq:       { name: 'Hauptquartier', def: 4, property: true },
  };

  // Kartenzeichen -> [Gelände, Besitzer] (null = neutral, 0 = Azur/Blau, 1 = Karmin/Rot)
  AW.TILE_CHARS = {
    '.': ['plain', null], '=': ['road', null], 'T': ['forest', null], '^': ['mountain', null],
    '~': ['river', null], 'w': ['sea', null],
    'c': ['city', null], '1': ['city', 0], '2': ['city', 1],
    'f': ['factory', null], 'F': ['factory', 0], 'G': ['factory', 1],
    'a': ['airport', null], 'P': ['airport', 0], 'Q': ['airport', 1],
    'A': ['hq', 0], 'B': ['hq', 1],
  };

  // Bewegungskosten je Bewegungsart; fehlender Eintrag = unpassierbar
  const BLD = { city: 1, factory: 1, airport: 1, hq: 1 };
  AW.MOVE_COST = {
    foot:   { plain: 1, road: 1, forest: 1, mountain: 2, river: 2, ...BLD },
    boot:   { plain: 1, road: 1, forest: 1, mountain: 1, river: 1, ...BLD },
    tread:  { plain: 1, road: 1, forest: 2, ...BLD },
    wheels: { plain: 2, road: 1, forest: 3, ...BLD },
    air:    { plain: 1, road: 1, forest: 1, mountain: 1, river: 1, sea: 1, ...BLD },
  };

  // minRange > 1 = indirekt: kein Angriff nach Bewegung, kein Gegenangriff
  AW.UNITS = {
    inf:     { name: 'Infanterie',        cost: 1000,  move: 3, moveType: 'foot',   minRange: 1, maxRange: 1, vision: 2, capture: true, domain: 'ground',
               desc: 'Billig, nimmt Gebäude ein, überquert Berge und Flüsse. Schwach gegen alles Gepanzerte.' },
    mech:    { name: 'Grenadier',         cost: 3000,  move: 2, moveType: 'boot',   minRange: 1, maxRange: 1, vision: 2, capture: true, domain: 'ground',
               desc: 'Panzerfaust: knackt Panzer und Späher. Langsam, teurer als Infanterie.' },
    recon:   { name: 'Späher',            cost: 4000,  move: 8, moveType: 'wheels', minRange: 1, maxRange: 1, vision: 5, domain: 'ground',
               desc: 'Sehr schnell auf Straßen, jagt Infanterie. Gegen Panzer chancenlos, schlecht im Wald.' },
    tank:    { name: 'Panzer',            cost: 7000,  move: 6, moveType: 'tread',  minRange: 1, maxRange: 1, vision: 3, domain: 'ground',
               desc: 'Vielseitiges Rückgrat. Verliert gegen Schwere Panzer, Grenadiere und Bomber.' },
    heavy:   { name: 'Schwerer Panzer',   cost: 16000, move: 5, moveType: 'tread',  minRange: 1, maxRange: 1, vision: 2, domain: 'ground',
               desc: 'Stärkste Bodeneinheit. Teuer und träge, verwundbar durch Bomber und Raketen.' },
    art:     { name: 'Artillerie',        cost: 6000,  move: 5, moveType: 'tread',  minRange: 2, maxRange: 3, vision: 2, domain: 'ground',
               desc: 'Feuert über 2–3 Felder ohne Gegenschlag. Kann nicht nach Bewegung feuern, wehrlos im Nahkampf.' },
    rocket:  { name: 'Raketenwerfer',     cost: 15000, move: 5, moveType: 'wheels', minRange: 3, maxRange: 5, vision: 2, domain: 'ground',
               desc: 'Größte Reichweite (3–5). Teuer, große tote Zone, im Nahkampf hilflos.' },
    aa:      { name: 'Flak',              cost: 8000,  move: 6, moveType: 'tread',  minRange: 1, maxRange: 1, vision: 2, domain: 'ground',
               desc: 'Holt Luftziele vom Himmel, zerfetzt Infanterie. Gegen Panzer schwach.' },
    heli:    { name: 'Kampfhubschrauber', cost: 9000,  move: 6, moveType: 'air',    minRange: 1, maxRange: 1, vision: 3, domain: 'air',
               desc: 'Fliegt über jedes Gelände, guter Allround-Jäger am Boden. Beute für Flak und Jäger.' },
    fighter: { name: 'Jäger',             cost: 20000, move: 9, moveType: 'air',    minRange: 1, maxRange: 1, vision: 4, domain: 'air',
               desc: 'Luftüberlegenheit: vernichtet Hubschrauber und Bomber. Kann keine Bodenziele angreifen.' },
    bomber:  { name: 'Bomber',            cost: 22000, move: 7, moveType: 'air',    minRange: 1, maxRange: 1, vision: 2, domain: 'air',
               desc: 'Verheerend gegen alles am Boden. Kann Luftziele nicht angreifen, fällt Flak und Jägern zum Opfer.' },
  };

  // Basisschaden in % (Angreifer -> Verteidiger). Fehlender Eintrag = kann nicht angreifen.
  AW.DAMAGE = {
    inf:     { inf: 55, mech: 45, recon: 12, tank: 5,  heavy: 1,  art: 15,  rocket: 25,  aa: 5,   heli: 7 },
    mech:    { inf: 65, mech: 55, recon: 85, tank: 55, heavy: 15, art: 70,  rocket: 85,  aa: 65,  heli: 9 },
    recon:   { inf: 70, mech: 65, recon: 35, tank: 6,  heavy: 1,  art: 45,  rocket: 55,  aa: 4,   heli: 10 },
    tank:    { inf: 75, mech: 70, recon: 85, tank: 55, heavy: 15, art: 70,  rocket: 85,  aa: 65,  heli: 10 },
    heavy:   { inf: 105, mech: 95, recon: 105, tank: 85, heavy: 55, art: 105, rocket: 105, aa: 105, heli: 12 },
    art:     { inf: 90, mech: 85, recon: 80, tank: 70, heavy: 45, art: 75,  rocket: 80,  aa: 75 },
    rocket:  { inf: 95, mech: 90, recon: 90, tank: 80, heavy: 55, art: 80,  rocket: 85,  aa: 85 },
    aa:      { inf: 105, mech: 105, recon: 60, tank: 25, heavy: 10, art: 50, rocket: 55,  aa: 45,  heli: 120, fighter: 65, bomber: 75 },
    heli:    { inf: 75, mech: 75, recon: 55, tank: 55, heavy: 25, art: 65,  rocket: 65,  aa: 25,  heli: 65 },
    fighter: { heli: 100, fighter: 55, bomber: 100 },
    bomber:  { inf: 110, mech: 110, recon: 105, tank: 105, heavy: 95, art: 105, rocket: 105, aa: 95 },
  };

  AW.BUILD_LISTS = {
    ground: ['inf', 'mech', 'recon', 'tank', 'heavy', 'art', 'rocket', 'aa'],
    air:    ['heli', 'fighter', 'bomber'],
  };

  AW.ECONOMY = {
    incomePerProperty: 1000,
    capturePoints: 20,     // Einnahme senkt um Anzeige-HP des Einnehmenden
    healHp: 20,            // interne HP (= 2 Anzeige-HP) pro Rundenbeginn auf eigenem Gebäude
    healCostFactor: 0.1,   // Kosten je 10 interne HP = 10 % der Einheitenkosten
    dayLimit: 40,          // danach gewinnt, wer mehr Gebäude besitzt
  };

  // atk: Angriffsbonus nach Gruppe; power wirkt bis Ende des eigenen Zuges. Ein Stern = 9000 Ladepunkte.
  AW.COMMANDERS = {
    mira:  { name: 'Mira Falk',   faction: 0, atk: {},
             passive: 'Ausgewogen, keine Schwächen.',
             power: { name: 'Sammelruf', stars: 3, heal: 20, atk: { all: 10 },
                      desc: 'Alle Einheiten +2 HP und +10 % Angriff.' } },
    tarek: { name: 'Tarek Hale',  faction: 0, atk: { indirect: 20, direct: -10 },
             passive: 'Indirekte Einheiten +20 %, direkte −10 %.',
             power: { name: 'Sperrfeuer', stars: 4, rangeBonus: { indirect: 1 }, atk: { indirect: 20 },
                      desc: 'Indirekte Einheiten +1 Reichweite und +20 % Angriff.' } },
    varek: { name: 'Marschall Varek', faction: 1, atk: { directGround: 15, indirect: -10 },
             passive: 'Direkte Bodeneinheiten +15 %, indirekte −10 %.',
             power: { name: 'Eisenwalze', stars: 4, moveBonus: { directGround: 1 }, atk: { directGround: 15 },
                      desc: 'Direkte Bodeneinheiten +1 Bewegung und +15 % Angriff.' } },
    sel:   { name: 'Sel',         faction: 1, atk: { air: 15 }, costMod: { air: -10 },
             passive: 'Lufteinheiten +15 % Angriff und 10 % billiger.',
             power: { name: 'Sturmschwinge', stars: 4, moveBonus: { air: 2 }, atk: { air: 20 },
                      desc: 'Lufteinheiten +2 Bewegung und +20 % Angriff.' } },
  };
  AW.POWER_STAR = 9000;

  AW.FACTIONS = [
    { name: 'Azur-Bund',          color: '#3b7dd8', dark: '#1f4f96', light: '#9cc3f2' },
    { name: 'Karmin-Hegemonie',   color: '#d8473b', dark: '#922a22', light: '#f2a39c' },
  ];

  // Parameter der KI-Stufen; Bedeutung: docs/AI.md
  AW.DIFFICULTY = {
    easy:   { name: 'Leicht',      incomeMul: 1.0 },
    normal: { name: 'Mittel',      incomeMul: 1.0 },
    hard:   { name: 'Schwer',      incomeMul: 1.0 },
    brutal: { name: 'Sehr schwer', incomeMul: 1.1 },
  };
})(globalThis);
