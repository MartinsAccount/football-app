# M8 – Mobil Szelvény-képernyő (ROADMAP 11.7)

Cél: a mobil appban szelvény összerakása az ajánlás-pillanatképből (`getRecommendations()`), Tippmix-odds beírása, mentés
AsyncStorage-ba a core `savedSlipsCodec`-kel (ugyanaz a formátum, mint a web `oe_saved_slips`-je).

## Szeletek / fájlok
1. core `slip/draft.ts` (+ teszt): `TIPPMIX_LABEL`, `SlipDraftTip`, `draftTipFromItem` (pillanatkép-tétel → láb),
   `draftLegs`, `buildSavedSlip` (tiszta: tippek + beírt oddsok + tét + idő → `ISavedSlip | null`).
2. web `recommendationsView.ts`: a `TIPPMIX_LABEL` a core-ból (duplikáció ki).
3. mobil `lib/storage.ts`: `RECOMMENDATIONS_CACHE_KEY`; `app/slip.tsx`: tipplista (toggle), kész szelvények
   (`buildSlipPresets`), lábak odds-beírással + státusz, tét-lépcső, összesítő (`summarizeSlip`, `oneInText`), mentés,
   mentett szelvények listája; `_layout.tsx`: „Szelvény” link + képernyő.

## Döntések
- Tét-lépcső fix `[500, 1000, 2000, 5000]` (a web alapértéke); a beállításokból az M9-ben jön (TODO(polish)).
- Mentett szelvény törlése nincs (adatvesztő; később).
- Ellenőrzés: core teszt, `tsc --noEmit` (mobil + frontend), `expo export --platform android`.
