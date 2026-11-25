# I31 – 1.6b Web-login (egy admin-jelszó, session cookie)

Cél: a web a Vercelen bejelentkezés után használható. Egyetlen felhasználó (a tulajdonos), ezért nincs felhasználónév és
felhasználó-tábla: egy jelszó, aminek csak a hash-e él az env-ben. A mobil marad a Bearer tokennél.

## Szerver (`packages/server/src/session.ts`)

- Jelszó-hash: PBKDF2-SHA256 (Web Crypto), `pbkdf2-sha256$<iter>$<salt>$<hash>` → `APP_PASSWORD_HASH`.
- Session: állapotmentes, aláírt süti `oe_session=<lejárat>.<HMAC-SHA256(SESSION_SECRET)>`, 30 nap;
  `HttpOnly; SameSite=Strict; Path=/api; Secure` (productionben). Kijelentkezés: `Max-Age=0`.
  Szerveroldali visszavonás nincs: a `SESSION_SECRET` cseréje minden sütit érvénytelenít.
- `POST /api/login` `{ password }` → 200 `{ authenticated: true }` + süti; rossz jelszó 401; 5 hiba / 15 perc / IP → 429
  (példányon belüli memória, TODO(polish): DB-alapú). `POST /api/logout`. `GET /api/session` (nyilvános):
  `{ authenticated, loginEnabled }`.
- `Authorizer` az `auth.ts` bővítési pontján: érvényes süti = engedélyezett. Csak akkor kerül be, ha a hash és a titok is
  megvan (különben a dev nyitott marad, a Vercel fail-closed).
- Script: `npm run password -w @football/server` → `APP_PASSWORD_HASH` + egy új `SESSION_SECRET`.

## Contract + web

- contract: `SessionResponse`, `getSession()`, `login(password)`, `logout()`; hibakód `rate-limited`.
- web: `AuthGate` a `Main` körül: induláskor `getSession()`; ha nincs belépve → `LoginPage` (jelszómező, rejtett
  „admin” felhasználónév a jelszókezelőnek). Kijelentkezés: gomb a fejlécben. A Vite-proxy kiegészül.

## Ellenőrzés

Unit: hash/verify, süti aláírás/lejárat/hamisítás, login 200/401/429, router session-útvonalak, a Vercel-handler
fail-closed marad. UI: screenshot 1440 + 390, sötét + világos. Élesen: a tulajdonos felveszi a két env-et, redeploy.
