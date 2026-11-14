SHELL := /bin/zsh
.PHONY: install shop api dash test run reset-bugs

install:
	cd apps/api && uv sync && uv run playwright install chromium
	cd apps/demo-shop && npm install
	cd apps/dashboard && npm install
	cd packages/regression-tests && npm install && npx playwright install chromium

shop:
	cd apps/demo-shop && npm run build && APX_TEST_HOOKS=1 npm run start:prod

api:
	cd apps/api && uv run uvicorn apppilot.api.main:app --reload --port 8000

dash:
	cd apps/dashboard && npm run dev

test:
	cd apps/api && uv run pytest -q

run:
	python3 scripts/start-run.py

reset-bugs:
	curl -s -X POST localhost:3001/__test/bugs -H 'content-type: application/json' -d '{"cart_quantity_total":true,"profile_name_not_persisted":true,"first_order_link_404":true}'; echo
