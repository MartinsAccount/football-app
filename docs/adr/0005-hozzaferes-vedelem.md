# ADR 0005 — Hozzáférés-védelem: web-session + Bearer token mobilhoz

- **Státusz:** Elfogadva (2026-11-13, tulajdonos)
- **Dátum:** 2026-11-13
- **Kapcsolódó:** PRD D4 · architecture.md §6 · ADR-0003 · ADR-0010 · `docs/plans/mobile.md`

## Kontextus

Az architecture.md §6 két réteget javasolt: Vercel Authentication + egyfelhasználós cookie-session. A tulajdonos
Android-appot is kér (ADR-0010). A Vercel Authentication böngészős, Vercel-fiókos SSO: natív kliens (Expo `fetch`)
nem tud rajta átjutni, és a httpOnly cookie-s session natív appban körülményes.

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | Vercel Auth + cookie-session, mobil nincs | nincs új kód | a natív app nem éri el az API-t |
| B | Cookie-session (web) + egyfelhasználós Bearer token (mobil) | egyszerű, visszafordítható, nincs külső függőség | a tokent kézzel kell a telefonra vinni és rotálni |
| C | Supabase Auth mindkét kliensre | erős, kész megoldás | egy felhasználóhoz túlzás, több függőség |

## Döntés

**B** (a tulajdonos választotta). Az API minden `/api/*` kérésnél elfogad (1) érvényes web-sessiont vagy
(2) `Authorization: Bearer <token>` fejlécet, ahol a token sha256-hash-e az `APP_API_TOKEN_HASH` env-ben van
(időzítés-biztos összevetés). `/api/cron/*` továbbra is `CRON_SECRET`-tel védett. Lokálisan, ha a hash nincs beállítva
és nem production a környezet, az API nyitott. A Vercel Authentication a production-domainen csak akkor marad, ha a mobil
egy védelem nélküli API-útvonalon (vagy külön deploymenten) eléri a szervert; ezt az élesítéskor (ROADMAP 1.6) kell
beállítani.

## Következmények

- `packages/server`: auth-ellenőrzés + token-generáló script (M3).
- Mobil: a token `expo-secure-store`-ban; elvesztésekor új tokent kell generálni és az env-et frissíteni.
- architecture.md §6 ehhez igazítva; az env-táblába bekerül az `APP_API_TOKEN_HASH`.
