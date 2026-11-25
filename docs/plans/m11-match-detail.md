# M11 Meccs-részlet (mobil)

Cél: a mobil Meccsek listáról (`apps/mobile/src/app/index.tsx`) egy meccsre koppintva részlet-képernyő nyílik (expo-router
dinamikus route `match/[id].tsx`): fejléc csapatnevekkel, eredmény, odds-mozgás (odds-history).

A szelet >10 fájl lenne, ezért két részre bomlik.

## M11a – adat (DB + contract + server) – kész

- `@football/db` `Repository`: `listTeams(ids?)`, `listOdds(fixtureId)` (összes snapshot időrendben, quote-ok egy második
  `ANY($1)` lekérdezéssel); a `getLatestOdds` ugyanarra a privát selectre épül. Séma nem változik.
- `@football/contract`: `FixtureDto.homeTeamName/awayTeamName` (opcionális, `null` = nincs importált csapat), `FixtureResponse`,
  `OddsHistoryResponse`; kliens: `getFixture(id)`, `getOddsHistory(id)`.
- `@football/server`: `/api/fixtures` lapja csapatnevekkel (egy `listTeams` hívás/lap), `GET /api/fixtures/:id`,
  `GET /api/odds/:id/history` (404 ismeretlen meccsre, üres tömb ha nincs odds). Válaszok `satisfies` a contract-típusokra.
- Teszt: repository (history-sorrend, csapatok), contract↔server (nevek, history, 404).

## M11b – nézet + képernyő

- Core `odds/history.ts` (teszttel): snapshotok → piac/kimenet soronként a legjobb odd időbeli sora (nyitó, utolsó, változás %),
  piac-címke a meglévő core bet-type/piac-katalógusból; csak tiszta függvény.
- Mobil `src/app/match/[id].tsx`: `getFixture` + `getOddsHistory` párhuzamosan, `loadWithCache` (kulcs meccsenként), tokenek
  (`useRnTheme`), magyar számformázás (`format.ts`).
- `index.tsx`: a sor `Link href={/match/${id}}`, csapatnév ha van (különben `#id`).
- TODO(polish): odds-mozgás grafikon (sparkline), bukméker-nevek (a quote csak `bookmakerId`-t ad).
