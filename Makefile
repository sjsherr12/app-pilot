SHELL := /bin/bash
.PHONY: install shop api dash test run reset-bugs status stop preflight up wait reset pitch logs down

# Ports used by the local stack
DASH_PORT ?= 3000
PORTS := 3000 3001 3002 8000
LOG_DIR := .logs

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

# Demo-day checklist: env keys, tooling, gh auth, the three servers, seeded bug flags, replay run.
# make preflight DASH_PORT=3002 if the dashboard runs on another port.
preflight:
	@DASH_PORT=$(DASH_PORT) scripts/preflight.sh

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

# ---------------------------------------------------------------- demo day
# make pitch   -> start whatever is not running, reset the shop, run the checklist. Run it between pitches.
# make up      -> shop (:3001), api (:8000) and dashboard (:$(DASH_PORT)) in the background, logs in .logs/
# make reset   -> seeded bugs back ON and the demo tenant back to seed data (servers keep running)
# make logs    -> tail the three logs        make down -> stop everything (same as make stop)
up:
	@mkdir -p $(LOG_DIR)
	@if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then echo "  shop      already on :3001"; else \
	  echo "  shop      starting on :3001 (building first if needed)"; \
	  ( cd apps/demo-shop && { [ -f .next/BUILD_ID ] || npm run build >> ../../$(LOG_DIR)/shop.log 2>&1; } && \
	    APX_TEST_HOOKS=1 nohup npm run start:prod >> ../../$(LOG_DIR)/shop.log 2>&1 & ); fi
	@if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then echo "  api       already on :8000"; else \
	  echo "  api       starting on :8000"; \
	  ( cd apps/api && nohup uv run uvicorn apppilot.api.main:app --port 8000 >> ../../$(LOG_DIR)/api.log 2>&1 & ); fi
	@if lsof -nP -iTCP:$(DASH_PORT) -sTCP:LISTEN >/dev/null 2>&1; then echo "  dashboard already on :$(DASH_PORT)"; else \
	  echo "  dashboard starting on :$(DASH_PORT)"; \
	  ( cd apps/dashboard && nohup npm run dev -- -p $(DASH_PORT) >> ../../$(LOG_DIR)/dash.log 2>&1 & ); fi
	@$(MAKE) --no-print-directory wait

# Block until all three answer (up to 3 minutes; the first shop build takes about a minute)
wait:
	@for i in $$(seq 1 180); do \
	  s=$$(curl -s -o /dev/null -m 2 -w '%{http_code}' localhost:3001/); \
	  a=$$(curl -s -o /dev/null -m 2 -w '%{http_code}' localhost:8000/health); \
	  d=$$(curl -s -o /dev/null -m 5 -w '%{http_code}' localhost:$(DASH_PORT)/); \
	  if [ "$$s$$a$$d" = "200200200" ]; then \
	    echo "  ready     shop http://localhost:3001  api http://localhost:8000  dashboard http://localhost:$(DASH_PORT)"; exit 0; fi; \
	  sleep 1; done; \
	echo "  timed out waiting (shop=$$s api=$$a dashboard=$$d); see make logs"; exit 1

# Seeded bugs back on, demo tenant back to seed data. Safe to run while everything is up.
reset:
	@curl -s -X POST localhost:3001/__test/bugs -H 'content-type: application/json' \
	  -d '{"cart_quantity_total":true,"profile_name_not_persisted":true,"first_order_link_404":true}' >/dev/null \
	  && echo "  bugs      all three ON" || { echo "  shop is not running (make up)"; exit 1; }
	@curl -s -X POST 'localhost:3001/__test/reset?tenant=default' >/dev/null && echo "  tenant    default reset to seed data"
	@echo "  reminder  close any rehearsal PR before the live Export-to-PR beat: gh pr list --search 'head:apppilot/'"

pitch: up reset
	@$(MAKE) --no-print-directory preflight DASH_PORT=$(DASH_PORT)

logs:
	@tail -n 20 -F $(LOG_DIR)/shop.log $(LOG_DIR)/api.log $(LOG_DIR)/dash.log

down: stop
