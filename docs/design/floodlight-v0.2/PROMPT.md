# Prompt a Claude CLI-nek

> Másold be az alábbi blokkot egy-az-egyben a Claude CLI-be, miután ezt a mappát
> bemásoltad a repóba: `docs/design/floodlight-v0.2/`. Ha máshová tetted, az első sorban
> írd át az útvonalat.

---

```text
Feladat: alakítsd át a football-app frontendjét a „Floodlight v0.2” design csomag szerint
(sötét + világos téma, átrendezett Ma és Kiértékelés oldal, a közös szabályok alapján
az Arbitrázs és a Beállítások is).

A csomag helye: docs/design/floodlight-v0.2/

OLVASD EL ELŐBB, ebben a sorrendben:
1. docs/design/floodlight-v0.2/README.md
2. docs/design/floodlight-v0.2/design/DESIGN.md      – szabályok, tokenek, komponensek, képletek
3. docs/design/floodlight-v0.2/CHANGES.md            – oldalankénti változások + „Kész, ha” feltételek
4. docs/design/floodlight-v0.2/screens/*.png         – így kell kinéznie (sötét/világos × 1440/390)
5. docs/design/floodlight-v0.2/reference/ma.html és kiertekeles.html forrása – pontos markup és osztályok
6. A PRD.md és a ROADMAP.md vonatkozó részei (különösen PRD 6., 9. és 12. fejezet)

SZABÁLYOK
- A PRD 12. fejezete érvényes: élő API-hívás nincs (mock / mentett adat), az API-kulcsokhoz
  nem nyúlsz, a tiszta logika (preset-, szelvény-, ítélet-, kalibráció-számítás) tiszta,
  unit-tesztelt függvény a magban; a komponens csak megjelenít.
- Tokenek: a design/tokens/ mappát másold a frontendbe (frontend/src/design/tokens/), a
  components.css-t a frontend/src/design/components/ alá. A tokens.css és tokens.ts generált
  fájl: `node frontend/src/design/tokens/build-tokens.mjs`. Nyers hex/px a komponensekben tilos.
- A referencia-HTML végén lévő JavaScript csak demonstráció. Ne másold; az appban MobX store
  és komponensek csinálják ugyanezt.
- Ha a meglévő styling-megoldás (CSS-fájl, CSS modules, styled stb.) eltér, választhatsz:
  a components.css oe-* osztályait használod közvetlenül, vagy a tokenekre építve saját
  stílust írsz. A vizuális eredmény egyezzen a screenshotokkal.
- NE TALÁLJ KI ADATOT. Ha valami a tervben szerepel, de az app adatai között nincs (pl.
  egymás elleni meccsek, utolsó 5, tabella-zónák, „Miért?” tényezők pp-értékkel, a ROI
  konfidencia-intervalluma), akkor azt a blokkot rejtsd el, és írd fel a jelentésben a
  „hiányzó adat” listára. Mintaszámokat ne égess be.
- Ami a PRD nem-céljai közé esik, azt nem kezded el, hanem jelzed.
- Üzleti logikát, modellt, ingestiont, DB-sémát nem módosítasz.

MUNKAMENET
0. Felderítés és terv – NE írj még kódot.
   Térképezd fel a frontendet: build-eszköz, router, store (MobX), styling, a négy oldal
   komponensei, meglévő témák/színek, tesztelés, screenshot-készítés lehetősége.
   Írd meg: docs/plans/redesign-floodlight-v0.2.md
   - referencia-blokk → komponens leképezés (melyik meglévő fájlt módosítod, mit hozol létre),
   - a szeletek sorrendje (lásd lent), szeletenként érintett fájlok,
   - mely adatok hiányoznak a tervhez,
   - kockázatok és nyitott kérdések.
   Utána ÁLLJ MEG, és kérd a jóváhagyásomat.

1. szelet – Tokenek és téma: tokens + components.css beépítése, data-theme mechanika
   villanásmentes inline scripttel, témaváltó a fejlécben, a meglévő nyers színek
   kiváltása tokenekre. (CHANGES.md 0.)
2. szelet – Közös keret: fejléc, navigáció, státusz-pill, kompakt oldalcímek,
   kiemelés-fegyelem. (CHANGES.md 1.)
3. szelet – Ma oldal: adat-állapot sor, új tippkártya, szelvény presetekkel az üres
   állapotban, sticky szelvény; a preset- és kockázat-logika unit-tesztekkel. (CHANGES.md 2.)
4. szelet – Kiértékelés oldal: ítélet-sáv, sikermutatók, KPI-k viszonyítással, pontosság,
   kalibráció; az ítélet- és cél-logika unit-tesztekkel. (CHANGES.md 3.)
5. szelet – Arbitrázs: szövegek, történeti-adat jelzés, a kerekítési címke-hiba javítása
   teszttel. (CHANGES.md 4.)
6. szelet – Beállítások: szekció-menü, csak a hiányzó coverage, semleges kiválasztás,
   Megjelenés szekció, mentés-sáv. (CHANGES.md 5.)

MINDEN SZELET UTÁN
- typecheck + tesztek zöldek;
- screenshot az érintett oldalakról: sötét és világos téma × 1440 és 390 px
  (docs/plans/screens/<szelet>-<oldal>-<téma>-<szélesség>.png);
- vesd össze a csomag screens/ képeivel; ellenőrizd, hogy nincs vízszintes görgetés;
- rövid jelentés: mi készült el, mely „Kész, ha” pontok teljesültek, mi tér el és miért,
  hiányzó adatok;
- egy szelet = egy commit, utána várd meg, hogy szóljak, mehet-e a következő.
```

---

## Ha kisebb lépésekben szeretnéd
Ugyanezt a promptot használhatod egy-egy szeletre is: a végére írd oda, hogy
„Most csak a 0. lépést (terv) csináld meg”, vagy „Most a 3. szelet jön”.
