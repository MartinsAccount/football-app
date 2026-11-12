#!/usr/bin/env bash
# Autonóm fejlesztési ciklus: minden szelet egy FRISS Claude-folyamat (tiszta kontextus).
# Indítás:   MAX_ITER=6 ./scripts/autodev.sh
# Leállítás: touch STOP   (a futó szelet még befejeződik)
set -uo pipefail

MAX_ITER="${MAX_ITER:-6}"
# Költségplafon a futás egészére, API-egyenértékben (a statuszsorban látott "~$" érték).
# Ha az összeg eléri, a script leáll. Kalibráld a saját keretedhez.
BUDGET_USD="${BUDGET_USD:-40}"
spent=0
mkdir -p .autodev

# Ha be van állítva, a futások API-számlára mennek, nem az előfizetésed keretére.
unset ANTHROPIC_API_KEY

branch="$(git branch --show-current)"
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "Ne a $branch ágon fuss: git switch -c autodev"; exit 1
fi

for i in $(seq 1 "$MAX_ITER"); do
  [ -f STOP ] && { echo "STOP fájl, kilépés."; rm -f STOP; break; }
  grep -qx "ALL_DONE" docs/STATE.md && { echo "Minden szelet kész."; break; }

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
    --output-format json > ".autodev/run-$i.json"

  run_cost="$(jq -r '.total_cost_usd // 0' ".autodev/run-$i.json" 2>/dev/null || echo 0)"
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
