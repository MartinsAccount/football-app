# Terv: mobil (Android) – PWA most, Expo-előkészítés

Döntés: tulajdonos, 2026-11-13 (ADR-0010, ADR-0005). Igény: offline olvasás + teljes funkció telefonon, saját telepítés
(APK / PWA, nincs Play Store), push nem kell.

## Kiinduló állapot

- Újrahasznosítható: `packages/core` (tiszta TS), `packages/server` (Web Request→Response), `tokens.json`.
- Nem hordozható: `frontend` (React 17, MobX 5 dekorátorok, class komponensek, Tailwind/CSS) → Expo-ban újraírandó.
- Akadály: a Vercel Authentication natív klienst nem enged át → Bearer token kell (ADR-0005).
- Az API-szerződés (DTO-típusok) nincs megosztva; Settings/Slip/Theme csak localStorage-ban.

## Szeletek (egy szelet = egy commit)

- **M1 PWA:** valódi `manifest.json` (név, Floodlight-színek, maskable ikonok), kézi service worker (`public/sw.js`):
  app-shell precache, `/api/*` és fixture-JSON network-first + cache-fallback (offline olvasás), csak prod-buildben
  regisztrálva; offline-jelző az AppShellben. A cache-stratégia tiszta segédfüggvénye tesztelt.
- **M2 `packages/contract`:** az olvasó API DTO-típusai + platformfüggetlen `createApiClient({ baseUrl, token?, fetch })`
  (nincs DOM, nincs localStorage). A server ezekből a típusokból válaszol. Unit-tesztek.
- **M3 Bearer auth a serveren:** `APP_API_TOKEN_HASH` (sha256), időzítés-biztos összevetés; ha nincs beállítva és nem
  production → nyitott (lokális dev). Token-generáló script. Unit-tesztek.
- **M4 Hordozható állapot:** a Settings/Slip/Theme tiszta része (alapértékek, validálás, (de)szerializálás) a core-ba;
  `KeyValueStorage` (async) interfész, a webes store-ok localStorage-adapterrel. Viselkedés változatlan.
- **M5 `packages/theme`:** a `build-tokens.mjs` a CSS/TS mellé generál egy feloldott értékű (CSS-változó nélküli)
  `{ dark, light }` témát RN-hez.
- **M6 Expo-váz `apps/mobile`:** Expo + expo-router + TS, egy képernyő (Ajánlások lista) a contract-kliensen, token
  `expo-secure-store`-ban, utolsó válasz cache-elve (offline). Nem része a gyökér-workspace-nek, ha a React-verzió
  ütközne (React 17 web vs. Expo React 19) – döntés a DECISIONS.md-be. APK-build (EAS-fiók / Android SDK) → BLOCKERS.

## Utána (nem ennek a tervnek a része)

Expo-képernyők fokozatosan (Ajánlások → Kiértékelés → Szelvény → Beállítások → Arbitrázs), a Supabase/Vercel
élesítés után valódi API-val. A web React 18 / MobX 6 frissítése (ROADMAP 9.2) a közös kódot tovább könnyíti.

## Becslés

PWA: 1 szelet. Előkészítés (M2–M6): 5 szelet. Teljes Expo-paritás: további kb. 12–18 szelet.
