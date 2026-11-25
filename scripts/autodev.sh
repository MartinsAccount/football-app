#!/usr/bin/env bash
# Autonóm fejlesztési ciklus: minden szelet egy FRISS Claude-folyamat (tiszta kontextus).
# Indítás:   BUDGET_USD=20 MAX_ITER=20 WEEKLY_MAX_PCT=78 ./scripts/autodev.sh
# Leállítás: touch STOP   (a futó kör még befejeződik)
set -uo pipefail

MAX_ITER="${MAX_ITER:-6}"
BUDGET_USD="${BUDGET_USD:-40}"                        # költségplafon (API-egyenérték, $)
WEEKLY_MAX_PCT="${WEEKLY_MAX_PCT:-78}"                # heti felhasznált % plafon
WEEKLY_PCT_CMD="${WEEKLY_PCT_CMD:-./scripts/weekly-usage.sh}"  # egy számot ír ki: heti felhasznált %
spent=0
mkdir -p .autodev

# Ha be van állítva, a futások API-számlára mennek, nem az előfizetésed keretére.
unset ANTHROPIC_API_KEY

# Leállás: a STATE.md „## Aktuális fázis” fejezete utáni, PONTOSAN „ALL_DONE” sor (szóköz/CR nélkül nézve).
# A régi „ALL_DONE M1”-típusú sorok nem számítanak.
all_done() {
  awk '/^## Aktuális fázis/{f=1;next} f{sub(/\r$/,"");gsub(/^[ \t]+|[ \t]+$/,"")} f&&$0=="ALL_DONE"{found=1} END{exit !found}' docs/STATE.md
}

weekly_used_pct() {
  [ -x "$WEEKLY_PCT_CMD" ] || return 1
  local v
  v="$("$WEEKLY_PCT_CMD" 2>/dev/null | tr -d '[:space:]%')"
  [[ "$v" =~ ^[0-9]+([.][0-9]+)?$ ]] || return 1
  echo "$v"
}

branch="$(git branch --show-current)"
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "Ne a $branch ágon fuss: git switch -c autodev"; exit 1
fi

if pct="$(weekly_used_pct)"; then
  echo "Heti limit-figyelés: BE (most $pct%, plafon $WEEKLY_MAX_PCT%)"
else
  echo "Heti limit-figyelés: NEM elérhető ($WEEKLY_PCT_CMD), csak a \$$BUDGET_USD költségplafon véd"
fi

for i in $(seq 1 "$MAX_ITER"); do
  [ -f STOP ] && { echo "STOP fájl, kilépés."; rm -f STOP; break; }
  all_done && { echo "Minden szelet kész."; break; }

  if pct="$(weekly_used_pct)"; then
    echo "Heti felhasználás: $pct% / $WEEKLY_MAX_PCT%"
    if awk -v p="$pct" -v m="$WEEKLY_MAX_PCT" 'BEGIN{exit !(p>=m)}'; then
      echo "Elérte a heti plafont, leállok."; break
    fi
  else
    echo "Heti felhasználás: nem olvasható ki ebben a körben"
  fi

  before="$(git rev-parse HEAD)"
  echo "== $i. kör $(date '+%H:%M') =="

  # A --permission-mode értékét ellenőrizd a 'claude --help' kimenetében.
  # Ha az 'auto' nem érhető el headless módban, használd ezt:
  #   --permission-mode acceptEdits --allowedTools "Bash(npm *)" "Bash(npx *)" "Bash(git add *)" "Bash(git commit *)"
  claude -p "$(cat docs/AUTODEV_PROMPT.md)" \
    --model opus \
    --effort medium \
    --permission-mode auto \
    --max-turns 80 \
    --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
    --output-format json > ".autodev/run-$i.json"

  if ! run_cost="$(node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const c = j.total_cost_usd;
    if (typeof c !== "number" || !Number.isFinite(c)) process.exit(1);
    console.log(c);
  ' ".autodev/run-$i.json" 2>/dev/null)" || [ -z "$run_cost" ]; then
    echo "A kör költsége nem olvasható ki, biztonsági leállás."; break
  fi
  spent="$(awk -v a="$spent" -v b="$run_cost" 'BEGIN{printf "%.2f", a+b}')"
  echo "Kör költsége: \$$run_cost, összesen: \$$spent / \$$BUDGET_USD"

  if awk -v s="$spent" -v b="$BUDGET_USD" 'BEGIN{exit !(s>=b)}'; then
    echo "Elérte a költségplafont, leállok."; break
  fi

  if [ "$before" = "$(git rev-parse HEAD)" ]; then
    echo "Nem jött új commit (lehet keret-limit vagy elakadás). Nézd: docs/BLOCKERS.md, .autodev/run-$i.json"
    break
  fi
  git log -1 --oneline
done
