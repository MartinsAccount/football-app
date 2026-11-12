# ADR 0003 — Hosting: Vercel Hobby

- **Státusz:** Elfogadva (2026-11-12, tulajdonos)
- **Dátum:** 2026-11-12
- **Kapcsolódó:** PRD D2 · [`architecture.md` §3](../architecture.md) · ROADMAP 1.0, 1.6, 1.7

## Kontextus

Az app egyfelhasználós, de internetről elérhető lesz, ütemezett adatgyűjtéssel. Az
összevetés (2026-11-12-i limitekkel) az `architecture.md` §3-ban van.

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | **Vercel Hobby** | 300 s függvényidő; 15 percenkénti Schedules (béta); ingyenes Vercel Authentication; nincs kreditplafon | csak nem kereskedelmi használat; a Schedules béta |
| B | Netlify Free | ütemezett függvények minden csomagban | ütemezett függvény 30 s; 300 kredit/hó kemény limit (deploy = 15 kredit), elfogyáskor minden site leáll; jelszavas védelem csak Pro-ban |

## Döntés

**Vercel Hobby.** A hosszabb függvényidő elég egy lassított (rate-limitált) hívássorozathoz,
a védelem kód nélkül megoldott, és nincs „elfogyott a kredit, leállt az oldal” kockázat.

## Következmények

- Tartalék ütemező kell, ha a Schedules béta nem válik be: napi Cron Job vagy külső pinger
  (`CRON_SECRET`-tel).
- A repó gyökere lesz a Vercel-projekt gyökere (`frontend/` build + `api/` függvények).
