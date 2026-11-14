SHELL := /bin/bash
.PHONY: install shop api dash test run reset-bugs status stop

# Ports used by the local stack
DASH_PORT ?= 3000
PORTS := 3000 3001 3002 8000

install:
	cd apps/api && uv sync && uv run playwright install chromium
	cd apps/demo-shop && npm install
	cd apps/dashboard && npm install
	cd packages/regression-tests && npm install && npx playwright install chromium

shop:
	cd apps/demo-shop && npm run build && APX_TEST_HOOKS=1 npm run start:prod

api:
	cd apps/api && uv run uvicorn apppilot.api.main:app --reload --port 8000

# make dash            -> http://localhost:3000
# make dash DASH_PORT=3002
dash:
	cd apps/dashboard && npm run dev -- -p $(DASH_PORT)

test:
	cd apps/api && uv run pytest -q

run:
	python3 scripts/start-run.py

reset-bugs:
	curl -s -X POST localhost:3001/__test/bugs -H 'content-type: application/json' -d '{"cart_quantity_total":true,"profile_name_not_persisted":true,"first_order_link_404":true}'; echo

# Which of the stack's ports have a listener, and which process owns it
status:
	@for p in $(PORTS); do \
	  procs=$$(lsof -nP -iTCP:$$p -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $$1"("$$2")"}' | sort -u | paste -sd, -); \
	  printf "  :%-5s %s\n" $$p "$${procs:-free}"; \
	done

# Stop whatever is listening on the stack's ports (dashboard, shop, api)
stop:
	@for p in $(PORTS); do \
	  pids=$$(lsof -nP -tiTCP:$$p -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ' '); \
	  if [ -n "$$pids" ]; then echo "stopping :$$p (pid $$pids)"; kill $$pids 2>/dev/null || true; fi; \
	done
	@sleep 1; $(MAKE) --no-print-directory status
