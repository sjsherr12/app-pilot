#!/usr/bin/env bash
# Demo-day preflight for AppPilot.
#
# Checks everything the live demo depends on and prints one line per check:
#   ok    - ready
#   warn  - works, but something is worth knowing before you present
#   FAIL  - the demo beat that depends on it will not work
#
# Usage: make preflight            (or: scripts/preflight.sh)
#        DASH_PORT=3002 make preflight
#
# Exit code is non-zero when any check fails, so it can gate a rehearsal.

set -u
cd "$(dirname "$0")/.."

DASH_PORT="${DASH_PORT:-3000}"
SHOP_URL="${APP_URL:-http://localhost:3001}"
API_URL="${API_URL:-http://localhost:8000}"
DASH_URL="http://localhost:${DASH_PORT}"
REPLAY_RUN="${REPLAY_RUN:-run_6b4c9ec9}"

fails=0
warns=0

if [ -t 1 ]; then
  G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; B=$'\033[1m'; N=$'\033[0m'
else
  G=""; Y=""; R=""; D=""; B=""; N=""
fi

ok()   { printf "  %sok%s    %s\n" "$G" "$N" "$1"; }
warn() { printf "  %swarn%s  %s\n" "$Y" "$N" "$1"; warns=$((warns + 1)); }
fail() { printf "  %sFAIL%s  %s\n" "$R" "$N" "$1"; fails=$((fails + 1)); }
section() { printf "\n%s%s%s\n" "$B" "$1" "$N"; }
hint() { printf "        %s%s%s\n" "$D" "$1" "$N"; }

# Reads KEY from .env without exporting anything else. Prints the value or nothing.
env_value() {
  [ -f .env ] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 | sed 's/^"\(.*\)"$/\1/; s/^'"'"'\(.*\)'"'"'$/\1/'
}

http_code() { local c; c="$(curl -s -o /dev/null -m 4 -w '%{http_code}' "$1" 2>/dev/null)"; echo "${c:-000}"; }

# ---------------------------------------------------------------- environment
section "Environment"

if [ -f .env ]; then
  ok ".env present"
else
  fail ".env missing"
  hint "cp .env.example .env and fill in ANTHROPIC_API_KEY"
fi

key="$(env_value ANTHROPIC_API_KEY)"
if [ -z "$key" ]; then
  fail "ANTHROPIC_API_KEY is empty: no run can start"
elif [[ "$key" != sk-ant-* ]]; then
  warn "ANTHROPIC_API_KEY does not look like an Anthropic key (expected sk-ant-...)"
else
  ok "ANTHROPIC_API_KEY set"
fi

if [ "$(env_value LANGSMITH_TRACING)" = "true" ]; then
  if [ -n "$(env_value LANGSMITH_API_KEY)" ]; then
    ok "LangSmith tracing on, key set (project: $(env_value LANGSMITH_PROJECT))"
  else
    warn "LANGSMITH_TRACING=true but LANGSMITH_API_KEY is empty: runs will log tracing errors"
    hint "Fill in the key or set LANGSMITH_TRACING=false"
  fi
else
  ok "LangSmith tracing off"
fi

model="$(env_value APPPILOT_MODEL)"
[ -n "$model" ] && ok "Model: $model (supervisor effort $(env_value APPPILOT_SUPERVISOR_EFFORT), workers $(env_value APPPILOT_WORKER_EFFORT))" \
                || warn "APPPILOT_MODEL not set; the API falls back to its built-in default"

# ---------------------------------------------------------------- tooling
section "Tooling"

if command -v uv >/dev/null 2>&1; then ok "uv $(uv --version 2>/dev/null | awk '{print $2}')"; else fail "uv not installed"; hint "brew install uv"; fi

if command -v node >/dev/null 2>&1; then
  nv="$(node -v)"
  major="${nv#v}"; major="${major%%.*}"
  if [ "$major" -ge 20 ]; then ok "node $nv"; else fail "node $nv is too old (need 20+)"; fi
else
  fail "node not installed"
fi

if [ -d apps/api/.venv ]; then
  if (cd apps/api && uv run --no-sync python -c "import deepagents, playwright, fastapi" >/dev/null 2>&1); then
    ok "Python deps importable (deepagents, playwright, fastapi)"
  else
    fail "Python deps missing or broken"; hint "cd apps/api && uv sync"
  fi
else
  fail "apps/api/.venv missing"; hint "make install"
fi

for d in apps/demo-shop apps/dashboard packages/regression-tests; do
  if [ -d "$d/node_modules" ]; then ok "$d/node_modules"; else fail "$d/node_modules missing"; hint "make install"; fi
done

chromium_dirs="$(ls -d "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"/chromium-* 2>/dev/null | wc -l | tr -d ' ')"
if [ "$chromium_dirs" -gt 0 ]; then
  ok "Playwright Chromium installed ($chromium_dirs build(s))"
else
  fail "No Playwright Chromium found"; hint "cd apps/api && uv run playwright install chromium; cd packages/regression-tests && npx playwright install chromium"
fi

# ---------------------------------------------------------------- pull request export
section "Pull request export"

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    ok "gh authenticated as $(gh api user -q .login 2>/dev/null || echo '?')"
  else
    warn "gh installed but not logged in: the Export to PR beat will fail"
    hint "gh auth login"
  fi
else
  warn "gh not installed: the Export to PR beat will fail"
  hint "brew install gh && gh auth login"
fi

if git remote get-url origin >/dev/null 2>&1; then
  ok "git remote origin: $(git remote get-url origin)"
  if git fetch --dry-run origin >/dev/null 2>&1; then ok "origin reachable"; else warn "origin not reachable right now (offline?)"; fi
else
  warn "no git remote named origin: PR export has nowhere to push"
fi

dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
if [ "$dirty" = "0" ]; then ok "working tree clean"; else warn "$dirty uncommitted change(s) in the working tree"; fi

# ---------------------------------------------------------------- servers
section "Servers"

shop_code="$(http_code "$SHOP_URL/")"
if [ "$shop_code" = "200" ]; then
  ok "demo shop up at $SHOP_URL"
  bugs_json="$(curl -s -m 4 "$SHOP_URL/__test/bugs" 2>/dev/null)"
  if [ -z "$bugs_json" ] || [[ "$bugs_json" != *cart_quantity_total* ]]; then
    fail "test hooks not enabled on the shop (GET /__test/bugs returned nothing useful)"
    hint "Start it with make shop, which sets APX_TEST_HOOKS=1"
  else
    off="$(printf '%s' "$bugs_json" | tr ',{}' '\n\n\n' | grep -E '":\s*false' | sed 's/[" ]//g; s/:false//' | paste -sd, -)"
    if [ -z "$off" ]; then
      ok "all three seeded bugs are ON"
    else
      warn "seeded bug(s) currently FIXED: $off"
      hint "make reset-bugs   (otherwise the run will find nothing)"
    fi
  fi
  reset_code="$(curl -s -o /dev/null -m 4 -w '%{http_code}' -X POST "$SHOP_URL/__test/reset?tenant=preflight" 2>/dev/null)"; reset_code="${reset_code:-000}"
  if [ "$reset_code" = "200" ]; then ok "tenant reset hook works"; else fail "POST /__test/reset returned $reset_code (verifier cannot get a fresh environment)"; fi
else
  fail "demo shop not responding at $SHOP_URL (HTTP $shop_code)"
  hint "make shop"
fi

api_code="$(http_code "$API_URL/health")"
if [ "$api_code" = "200" ]; then
  ok "API up at $API_URL"
  runs_code="$(http_code "$API_URL/api/runs")"
  [ "$runs_code" = "200" ] && ok "GET /api/runs responds" || fail "GET /api/runs returned $runs_code"
else
  fail "API not responding at $API_URL/health (HTTP $api_code)"
  hint "make api"
fi

dash_code="$(http_code "$DASH_URL/")"
if [ "$dash_code" = "200" ]; then
  ok "dashboard landing page up at $DASH_URL"
  runs_page="$(http_code "$DASH_URL/runs")"
  if [ "$runs_page" = "200" ]; then
    ok "console at $DASH_URL/runs"
  else
    fail "$DASH_URL/runs returned $runs_page"
    hint "A dev server started before the route-group move needs a restart: make dash DASH_PORT=$DASH_PORT"
  fi
else
  fail "dashboard not responding at $DASH_URL (HTTP $dash_code)"
  hint "make dash DASH_PORT=$DASH_PORT"
fi

# ---------------------------------------------------------------- demo safety net
section "Demo safety net"

if [ -d "data/runs/$REPLAY_RUN" ] && [ -s "data/runs/$REPLAY_RUN/events.jsonl" ]; then
  n_find="$(ls "data/runs/$REPLAY_RUN/findings" 2>/dev/null | wc -l | tr -d ' ')"
  n_test="$(ls "data/runs/$REPLAY_RUN/tests" 2>/dev/null | wc -l | tr -d ' ')"
  ok "replay run $REPLAY_RUN present ($n_find findings, $n_test tests)"
  [ "$api_code" = "200" ] && { rc="$(http_code "$API_URL/api/runs/$REPLAY_RUN")"; [ "$rc" = "200" ] && ok "API serves the replay run" || fail "API returned $rc for the replay run"; }
else
  warn "replay run $REPLAY_RUN not found under data/runs: no fallback if the live run misbehaves"
fi

if [ -f docs/demo-script.md ]; then ok "docs/demo-script.md present"; else warn "docs/demo-script.md missing"; fi

if pmset -g batt 2>/dev/null | grep -q "AC Power"; then ok "on AC power"; else warn "on battery: plug in before a 10 minute live run"; fi

# ---------------------------------------------------------------- summary
echo
if [ "$fails" -gt 0 ]; then
  printf "%s%d check(s) failed%s, %d warning(s). Fix the FAIL lines before presenting.\n" "$R" "$fails" "$N" "$warns"
  exit 1
elif [ "$warns" -gt 0 ]; then
  printf "%sReady with %d warning(s).%s\n" "$Y" "$warns" "$N"
else
  printf "%sAll clear. Go present.%s\n" "$G" "$N"
fi
