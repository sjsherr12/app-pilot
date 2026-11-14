SHELL := /bin/zsh
.PHONY: install shop api dash test

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
