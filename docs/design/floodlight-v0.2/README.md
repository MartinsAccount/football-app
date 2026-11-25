# Odds elemző – „Floodlight v0.2” átalakítási csomag

Minden, ami ahhoz kell, hogy a Claude CLI a mostani appot az új tervek szerint alakítsa át:
sötét + világos téma, átrendezett **Ma** és **Kiértékelés** oldal, a közös szabályok
alapján az **Arbitrázs** és a **Beállítások** is.

## Használat (3 lépés)

1. Másold ezt a mappát a repóba: `docs/design/floodlight-v0.2/`
2. Nyisd meg a `PROMPT.md`-t, és a benne lévő blokkot másold be a Claude CLI-be.
3. A CLI először csak tervet ír (`docs/plans/redesign-floodlight-v0.2.md`), és megáll.
   Ha jó, hagyd jóvá; utána szeletenként halad, mindegyik után képernyőképpel és jelentéssel.

## Tartalom

```
floodlight-v0.2/
├── README.md              ← ez
├── PROMPT.md              ← a CLI-be bemásolandó prompt
├── CHANGES.md             ← oldalankénti változások + „Kész, ha” feltételek
├── design/                ← ez kerül a frontendbe (frontend/src/design/)
│   ├── DESIGN.md          ← szabályok, tokenek, komponensek, képletek, formázás
│   ├── tokens/
│   │   ├── tokens.json        ← FORRÁS: sötét alap (DTCG)
│   │   ├── tokens.light.json  ← FORRÁS: világos felülírások
│   │   ├── build-tokens.mjs   ← generátor (Node 18+, függőség nélkül)
│   │   ├── tokens.css         ← generált: :root + [data-theme="light"] + rendszer-téma
│   │   └── tokens.ts          ← generált: themes.dark / themes.light, cssVar, v(), THEME_STORAGE_KEY
│   └── components/
│       └── components.css     ← oe-* komponens-osztályok, csak tokenekre építve
├── reference/             ← böngészőben megnyitható, működő referenciaoldalak
│   ├── ma.html                (témaváltó, presetek, szelvény, lenyitó működik)
│   └── kiertekeles.html
└── screens/               ← így kell kinéznie
    ├── ma-{dark,light}-{1440,390}.png
    ├── ma-dark-1440-szelveny-kitoltve.png
    └── kiertekeles-{dark,light}-{1440,390}.png
```

A referenciaoldalak a `?theme=light` / `?theme=dark` paraméterrel is nyithatók.

## Megjegyzések
- A design kit előző verziója (`odds-elemzo-design-kit`) ezzel kiváltható: ez tartalmazza
  a világos témát és az új komponenseket. A v0.1 osztálynevek egy része megváltozott
  (pl. `.oe-card` → `.oe-tip`), lásd DESIGN.md §6.
- A tervekben szereplő számok a 2025. áprilisi mentett adatból vagy mintából valók
  (a Wolves–Tottenham tipp részletei, a forma, a tabella és az egymás elleni eredmények minták).
  A prompt kifejezetten tiltja, hogy a CLI ezeket beégesse.
