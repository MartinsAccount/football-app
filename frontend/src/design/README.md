# Odds elemző – design kit (Floodlight)

Token- és komponenskészlet a `football-app` új felületéhez, a Claude CLI-nek átadható formában.

```
odds-elemzo-design-kit/
├── README.md                 ← ez a fájl
├── DESIGN.md                 ← a teljes útmutató (elvek, komponensek, formázás, képletek)
├── tokens/
│   ├── tokens.json           ← FORRÁS (W3C DTCG formátum) – csak ezt szerkeszd
│   ├── build-tokens.mjs      ← generátor, függőség nélkül (Node 18+)
│   ├── tokens.css            ← generált: :root CSS-változók
│   └── tokens.ts             ← generált: tokens (nyers) + cssVar / v() (hivatkozás)
└── components/
    ├── components.css        ← komponens-osztályok (oe-*), csak tokenekre épül
    └── components.html       ← élő referencia: nyisd meg böngészőben
```

## Beépítés a repóba

1. Másold a mappát ide: `frontend/src/design/` (így: `frontend/src/design/tokens/…`,
   `frontend/src/design/components/…`, `frontend/src/design/DESIGN.md`).
2. A belépési pontban (pl. `src/index.tsx`):
   ```ts
   import './design/tokens/tokens.css';
   import './design/components/components.css';
   ```
3. Token módosítása után: `node frontend/src/design/tokens/build-tokens.mjs`
   (érdemes `package.json` scriptbe tenni: `"tokens": "node src/design/tokens/build-tokens.mjs"`).

## Blokk a CLAUDE.md-be

```md
## Design
- A UI a `frontend/src/design/DESIGN.md` szerint készül (Floodlight). Új vagy módosított
  komponens előtt olvasd el az érintett fejezetet.
- Szín, térköz, betű, rádiusz csak tokenből: CSS-ben `var(--…)`, TS-ben `v('…')` a
  `design/tokens/tokens.ts`-ből. Nyers hex/px tilos a komponensekben.
- A `tokens.css` és `tokens.ts` generált fájl; a forrás a `tokens.json`.
- Kinézet-referencia: `design/components/components.html` és `components.css` (oe-* osztályok).
- Számformázás magyarul (tizedesvessző, ezres szóköz), közös `format.ts`-ből.
- UI-változás után screenshot 1440 és 390 px szélességen; vízszintes görgetés nem lehet.
```

Minden szám a referenciaoldalon és a tervekben mintaadat.
