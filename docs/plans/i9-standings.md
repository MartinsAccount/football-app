# I9 – ROADMAP 3.4 `standings` snapshot (mock)

**Cél:** a planner `standings` feladata (forduló előtti UTC-nap, `{ league, season }`) → 1 hívás `/standings?league&season` →
insert a `standing_snapshot` táblába (`captured_at` = a futás ideje). 0 élő hívás.

## Szeletek / fájlok

1. `packages/server/src/standings.ts`: API-alak (`response[0].league.standings[][]`) → `StandingSnapshotRow`; handler: csapat
   upsert (`upsertTeams`), `season` sor (`upsertSeasonTeams`), majd insert `ON CONFLICT DO NOTHING` (csak ha a `season` létezik).
2. `referenceMocks.ts`: `standingsEnvelope` – a core `deriveStandings` a mentett meccsek (`FT`/`AET`/`PEN`) közül a visszajátszott
   időpont (`replayDay` + a nap ideje) előttiekből, API-alakra képezve; `withStandings` Proxy (az `asOf` a futás órájából jön, a
   kulcs csak `league&season`). `loadIngestMocks` bekötése.
3. `ingestWorker.ts` (`standings` handler), `index.ts` export, `scripts/tick.ts` komment.
4. `standings.test.ts`: leképezés, mock-tabella (pont-idejű, a később játszott meccs nem számít), worker-futás friss
   memória-PGlite-on: a snapshot a forduló előtti napon keletkezik, előtte nem; ismételt futás nem duplikál.

## Nem cél / polish

- `form`, `description` (BL/EK/kiesés zóna): a mentett adatból nem képezhető → `null` (TODO(polish)).
- Ligánkénti tiebreak (H2H): a core közelítése marad.
