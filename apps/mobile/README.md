# apps/mobile – Expo (Android) váz

ROADMAP 11.6, ADR-0010, ADR-0005, terv: `docs/plans/mobile.md`. Expo SDK 58 + expo-router + TypeScript.

**Nem tagja a gyökér npm-workspace-nek** (az Expo React 19-et kér, a web React 17-en van): saját `package.json` és
`package-lock.json`. A megosztott csomagokat (`@football/core`, `@football/contract`, `@football/theme`) TS-forrásként
éri el: Metro `watchFolders` + `extraNodeModules` (`metro.config.js`), TypeScript `paths` (`tsconfig.json`).

## Telepítés és ellenőrzés

```bash
cd apps/mobile
npm install            # ezen a gépen: NODE_OPTIONS=--use-system-ca (TLS-interception)
npx tsc --noEmit       # typecheck (a megosztott csomagokkal együtt)
npx expo export --platform android   # Metro-bundle próba (dist/ – git-ignored)
```

A gyökér `npm install` / `npm run verify` az apps/mobile-t nem érinti.

## Futtatás telefonon (Expo Go)

1. A gépen indítsd az olvasó API-t: `npm run dev -w @football/server` (a gyökérből; :5100).
2. `cd apps/mobile && npx expo start` → a QR-kódot olvasd be az **Expo Go** appal. A telefon és a gép
   **ugyanazon a LAN-on** legyen.
3. Az appban: **Beállítások** → API címe: `http://<a gép LAN-IP-je>:5100` (pl. `http://192.168.1.10:5100`; a
   `localhost` a telefonon a telefont jelenti). Windows-tűzfalon a 5100-as portot engedni kell.

## Token

Lokális, nem-production dev-szerveren token nélkül is nyitott az API (ADR-0005). Védett szerverhez:
`npm run token -w @football/server` generál tokent + hash-t; a hash az `APP_API_TOKEN_HASH` szerver-env-be kerül, a
tokent az app Beállítások képernyőjén kell megadni. A base URL és a token `expo-secure-store`-ban tárolódik, a token
nem kerül logba.

## Offline

Az utolsó sikeres `/api/fixtures` válasz AsyncStorage-ban van (`@football/core` `loadWithCache` +
`KeyValueStorage`-adapter: `src/lib/storage.ts`). Hálózati hibánál ebből jelenik meg, „offline – utolsó frissítés: …”
jelzéssel.

## APK-build (a tulajdonos lépése, lásd docs/BLOCKERS.md)

- **EAS (felhő, ingyenes Expo-fiókkal):** `npx eas-cli login`, `npx eas-cli build:configure`, majd
  `npx eas-cli build -p android --profile preview` (a `preview` profil `"android": { "buildType": "apk" }`-kal APK-t ad).
- **Lokálisan:** Android SDK + JDK 17 telepítése után `npx expo prebuild -p android` és
  `cd android && ./gradlew assembleRelease`.
