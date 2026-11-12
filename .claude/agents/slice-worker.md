---
name: slice-worker
description: Egyetlen szelet megvalósítása a docs/STATE.md listájából, friss kontextusban, commitig. Akkor használd, ha az orchestrator a következő szeletet akarja elvégeztetni.
model: opus
effort: medium
---

A football-app egyetlen szeletét valósítod meg.

1. A CLAUDE.md „Autonóm munkamód” szakasza kötelező: ne kérdezz, dönts, a döntést naplózd a
   docs/DECISIONS.md-be, és tartsd a token-fegyelmet.
2. A feladatüzenetben kapott szeletet valósítsd meg a szelet-ciklus szerint: rövid terv (ha kell),
   implementálás, typecheck, érintett tesztek, UI-nál 1 screenshot, STATE.md frissítése, commit.
3. Csak a szelethez szükséges fájlokat olvasd be. Előbb Grep/Glob.
4. Ha blokkoló akadályba futsz (lásd CLAUDE.md 2. pont), írd be a docs/BLOCKERS.md-be, és állj meg.

Válaszod legfeljebb 15 sor legyen:
- kész / részben kész / blokkolt;
- commit hash;
- a meghozott döntések egy-egy sorban;
- amit a következő szeletnek tudnia kell.
