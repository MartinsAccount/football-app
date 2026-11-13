# ADR 0010 — Mobil: PWA most, Expo natív app később

- **Státusz:** Elfogadva (2026-11-13, tulajdonos)
- **Dátum:** 2026-11-13
- **Kapcsolódó:** PRD 8 (nem-célok) · ADR-0005 · ADR-0008 · `docs/plans/mobile.md` · ROADMAP 11

## Kontextus

A tulajdonos Androidon is használni akarja az appot: teljes funkcióval, offline olvasással, saját telepítéssel
(APK / PWA, Play Store nélkül). Push értesítés nem kell. A web-UI React 17 + MobX 5 dekorátorok + Tailwind, ez
React Native-ben nem használható újra; a `packages/core` és a `packages/server` viszont platformfüggetlen.

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | Csak PWA | 1 szelet, a mostani UI | nem natív, korlátozott eszközfunkciók |
| B | Capacitor-csomagolás | kevés munka, APK | webview, ugyanaz a UI, plusz natív build-lánc |
| C | Expo natív app | valódi natív élmény, a core újrahasznosul | a képernyőket újra kell írni (kb. 15–25 szelet) |
| D | PWA most + Expo-előkészítés | azonnal használható telefonon; a natív app útja kikövezve | két UI hosszabb távon |

## Döntés

**D** (a tulajdonos választotta). Most: telepíthető PWA offline olvasással. Előkészítés: megosztott API-szerződés és
kliens (`packages/contract`), Bearer-auth (ADR-0005), hordozható állapot-logika a core-ban, RN-téma a tokenekből,
Expo-váz `apps/mobile` alatt. A PRD „Mobil-first UI” nem-célja ezzel újranyílik a telepíthető/natív appra; a push
értesítés továbbra is nem-cél.

## Következmények

- Új fejezet: ROADMAP 11. Új csomagok: `packages/contract`, `packages/theme`; új mappa: `apps/mobile`.
- Új számoló logika továbbra is a core-ba kerül (a mobil is onnan veszi).
- APK-build: Expo EAS (ingyenes fiók) vagy lokális Android SDK, ez a tulajdonos beállítása (BLOCKERS).
