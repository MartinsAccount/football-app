# I4 – Feladatsor-mag (ROADMAP 3.1a, core, tiszta)

Cél: az `architecture.md` §7.1/§7.3 szabályai tiszta függvényként, I/O nélkül. A DB-tár és a tick-worker az I5.

## Fájlok

- `packages/core/src/ingest/tasks.ts` – típusok (`IngestTaskKind`, `IngestTaskStatus`, `TaskPlan`), `TASK_PRIORITY`,
  `planTasks(input)` (planner).
- `packages/core/src/ingest/queue.ts` – `isRunnable`, `selectNextTask` (prioritás → deadline → not_before → id), `expiredTaskIds`
  (deadline → `skipped`), `onTaskFailure` (backoff / plan-, kvótahiba nem ismétlődik aznap).
- tesztek mindkettőhöz, `index.ts` export.

## Planner-szabályok (input: `now`, ligák `{id, season}`, ismert meccsek `{id, leagueId, kickoff, status, round?}`)

| kind                        | csoport                                 | not_before          | deadline      | est. hívás | dedupe_key                        |
| --------------------------- | --------------------------------------- | ------------------- | ------------- | ---------- | --------------------------------- |
| `fixtures_window`           | liga × UTC-nap                          | nap 04:00           | nap vége      | 1          | `fixtures_window:L:S:YYYY-MM-DD`  |
| `reference` bookmakers/bets | ISO-hét                                 | most                | –             | 1          | `reference:bookmakers:2026-W47`   |
| `reference` teams           | liga × hónap                            | most                | –             | 1          | `reference:teams:L:S:2026-11`     |
| `odds_early`                | liga × meccsnap                         | első kezdés −48 h   | −24 h         | ⌈n/10⌉     | `odds_early:L:YYYY-MM-DD`         |
| `odds_late`                 | liga × meccsnap                         | első kezdés −3 h    | első kezdés   | ⌈n/10⌉     | `odds_late:L:YYYY-MM-DD`          |
| `injuries`                  | liga × meccsnap, 20-as köteg            | −24 h               | első kezdés   | 1          | `injuries:L:YYYY-MM-DD:i`         |
| `standings`                 | liga × forduló (vagy meccsnap)          | előző UTC-nap 00:00 | első kezdés   | 1          | `standings:L:S:<round>`           |
| `results`                   | liga × pontos kezdés × kör, 20-as köteg | kezdés +3 h / +26 h | +26 h / +72 h | 1          | `results:L:YYYY-MM-DDTHH:MM:p1:i` |

- Csak a `horizonHours` (alap 72) ablakba eső meccsek; lejárt határidejű terv nem keletkezik.
- `results`: csak nem végleges státuszú meccsre, és csak ha a kör már esedékes (a 2. kör így csak akkor, ha az 1. után sincs FT).
- `predictions_api`, `backfill_*`: nem tervez (TODO, külön szelet).

## Hibakezelés (`onTaskFailure`)

- `plan`, `token`, `permanent` → `failed` (nem ismétlődik); `quota`, `budget` → `pending`, `not_before` = következő UTC-éjfél,
  `attempts` nem nő; `transient` → `attempts+1`, `not_before = now + 15 perc · 2^(attempts−1)` (max 6 h), `maxAttempts` (5) után
  `failed`.
