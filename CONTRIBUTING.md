# Contributing

## Setup

```bash
git clone git@github.com:Darkmyter/mcp-carrefour-drive.git
cd mcp-carrefour-drive
npm install
npm run build
```

## Running Tests

```bash
# Unit tests (no browser needed)
npm test

# E2E tests (requires X11 display with Carrefour cookies)
DISPLAY=:0 CARREFOUR_DATA_DIR=~/.carrefour-mcp npm run test:e2e
```

## Project Structure

```
src/
├── index.ts       # MCP server — tool registration & schemas
├── browser.ts     # Playwright lifecycle, stealth config, cookie persistence
├── auth.ts        # Login / session check via Carrefour SSO
├── search.ts      # Product search & detail page extraction
├── cart.ts        # Cart operations (add, remove, get, update qty)
├── store.ts       # Store finder (partial — needs improvement)
├── slots.ts       # Delivery slots (untested)
├── checkout.ts    # Checkout flow (untested)
└── types.ts       # TypeScript interfaces

tests/
├── unit.test.ts   # Pure logic tests (no browser)
└── e2e.test.ts    # Live tests against carrefour.fr
```

## How Selectors Work

All page interactions use a single `page.evaluate()` call per operation — this is deliberate. The original code used per-element Playwright locators which caused 30s+ timeouts. The evaluate approach completes in 2–3s.

If Carrefour changes their website, update selectors in the relevant `src/*.ts` file and update the DOM Reference section in `README.md`.

## Code Style

- TypeScript with strict mode
- No semicolons (match existing style)
- Use `page.evaluate()` over per-element locators for performance
- Handle errors gracefully — return `{ success, message }` objects, never throw to the MCP layer
- Update `README.md` DOM Reference when changing selectors

## Submitting Changes

1. Fork the repo
2. Create a feature branch (`git checkout -b fix/cart-selector`)
3. Run tests (`npm test`)
4. Commit with a descriptive message
5. Push and open a Pull Request

## Upstream

This repo is forked from [maximeallanic/mcp-carrefour-drive](https://github.com/maximeallanic/mcp-carrefour-drive). To sync with upstream:

```bash
git fetch upstream
git merge upstream/main
```
