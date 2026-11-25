# I13 – ROADMAP 4.3 `standing_derived` (pont-idejű tabella)

**Cél:** a `fixture` táblából, a core `deriveStandings`-szel, liga×szezon×`as_of` tabellák a DB-ben (backtest, szezonszakasz,
tabellahely-feature). 0 élő hívás, additív migráció.

## Fájlok

1. `packages/db/migrations/0007_standing_derived.sql`: tábla (PK liga, szezon, `as_of`, csapat; FK `season`, `team`),
   oszlopok mint a `standing_snapshot` (form/description/group nélkül) + `computed_at`.
2. `packages/server/src/standingDerived.ts`: `loadSeasonMatches` (FT/AET/PEN + gól), `matchdayAsOfs` (meccsnapok UTC-éjfele +
   az utolsó meccsnap utáni éjfél), `upsertStandingDerived` (egy `unnest`-es upsert / `as_of`), `refreshStandingDerived`.
3. `results.ts`: befejezett meccs után az érintett liga×szezon újraszámolása (0 hívás). `index.ts` export.
4. `standingDerived.test.ts` (friss memória-PGlite): a mentett PL 2024 szezonvégi derived tabellája = a PL 2024/25 ismert
   végeredménye (pont + gólkülönbség, sorrend); pont-idejűség; idempotencia; `season` nélkül nem ír; results-hook.

## Nem cél / polish

- Ligánkénti tiebreak (H2H) és pontlevonás (pl. Serie A/Ligue 1 levonások) – a core közelítése marad.
- Olvasó API / UI a derived tabellához; a feature-építés (7.1) innen olvashat.
- A teljes szezon újraszámolása minden results-futáskor (≈40 upsert) – elég, később inkrementális lehet.
