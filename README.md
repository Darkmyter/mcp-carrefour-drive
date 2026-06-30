# mcp-carrefour-drive

An [MCP](https://modelcontextprotocol.io) server for [Carrefour Drive](https://www.carrefour.fr) — search products, manage your cart, and check out via any AI assistant that supports the Model Context Protocol.

> **Fork notice:** Forked from [maximeallanic/mcp-carrefour-drive](https://github.com/maximeallanic/mcp-carrefour-drive) with working selectors for the real Carrefour.fr website, anti-bot detection handling, and a full test suite.

## Features

- 🔍 **Product search** — query Carrefour's catalog with name, brand, price, Nutri-Score, and promo info
- 📦 **Product details** — nutrition facts, ingredients, allergens, price per unit
- 🛒 **Cart management** — add, remove, update quantities
- 🔐 **Session persistence** — cookies survive across MCP restarts
- ✅ **Tested** — unit tests (no browser) and E2E tests against the live site

## Installation

```bash
git clone https://github.com/Darkmyter/mcp-carrefour-drive.git
cd mcp-carrefour-drive
npm install
npm run build
```

Requires Node.js ≥ 18 and Playwright browsers:

```bash
npx playwright install chromium
```

## Configuration

### MCP Client Setup

Add to your MCP client config (e.g. `~/.hermes/config.yaml`):

```yaml
mcp:
  servers:
    carrefour-drive:
      command: node
      args:
        - /path/to/mcp-carrefour-drive/dist/index.js
      env:
        CARREFOUR_EMAIL: your-email@example.com
        CARREFOUR_PASSWORD: your-password
        DISPLAY: ":0"
        CARREFOUR_DATA_DIR: ~/.carrefour-mcp
      enabled: true
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CARREFOUR_EMAIL` | Yes | — | Your Carrefour account email |
| `CARREFOUR_PASSWORD` | Yes | — | Your Carrefour account password |
| `DISPLAY` | Yes | — | X11 display (e.g. `:0`). Required because DataDome blocks headless browsers. |
| `CARREFOUR_DATA_DIR` | No | `~/.carrefour-mcp` | Directory for cookie storage |

> **Why `DISPLAY`?** Carrefour.fr uses DataDome anti-bot protection that detects headless browsers. This server runs a visible Chromium window (it will appear on your display). Cookies persist in `CARREFOUR_DATA_DIR` so sessions survive restarts.

## Available Tools

| Tool | Status | Description |
|---|---|---|
| `search_products` | ✅ | Search by query, returns name, brand, price, image, promo |
| `get_product_details` | ✅ | Full product page: price, nutrition, ingredients, allergens |
| `add_to_cart` | ✅ | Navigate to product page and add to cart |
| `get_cart` | ✅ | View cart items and total |
| `remove_from_cart` | ✅ | Remove a product from the cart |
| `update_cart_quantity` | ⚠️ | Update item quantity (needs more testing) |
| `check_login` | ✅ | Check if session is valid |
| `login` | ⚠️ | Log in via Carrefour SSO (works, but SSO redirects can be flaky) |
| `select_store` | ⚠️ | Select a Carrefour Drive store (limited store finder) |
| `get_available_slots` | ❌ | List delivery time slots (untested) |
| `select_slot` | ❌ | Select a delivery slot (untested) |
| `get_checkout_summary` | ❌ | View order summary before payment (untested) |
| `confirm_and_pay` | 🚫 | Submit payment — **intentionally untested** for safety |

> ✅ = tested and working · ⚠️ = partially working · ❌ = untested · 🚫 = deliberately skipped

## Testing

```bash
# Unit tests — pure logic, no browser needed
npm test

# E2E tests — runs against live carrefour.fr (needs DISPLAY=:0)
DISPLAY=:0 CARREFOUR_DATA_DIR=~/.carrefour-mcp npm run test:e2e
```

## Development

```bash
# Watch mode (rebuilds on change)
npm run dev

# Watch tests
npm run test:watch
```

### Architecture

```
src/
├── index.ts       # MCP server — tool registration & zod schemas
├── browser.ts     # Playwright lifecycle, stealth config, cookie persistence
├── auth.ts        # Login / session check via Carrefour SSO
├── search.ts      # Product search & detail page extraction
├── cart.ts        # Cart operations (add, remove, get, update qty)
├── store.ts       # Store finder (partial)
├── slots.ts       # Delivery slots (untested)
├── checkout.ts    # Checkout flow (untested)
└── types.ts       # TypeScript interfaces

tests/
├── unit.test.ts   # Pure logic tests (no browser)
└── e2e.test.ts    # Live tests against carrefour.fr
```

All page interactions use a single `page.evaluate()` call per operation instead of per-element Playwright locators. This is deliberate — the original code's per-locator approach caused 30s+ timeouts; `evaluate()` completes in 2–3s.

## Carrefour.fr DOM Reference

This is the **source of truth** for all CSS selectors. If the website changes and tests break, update these in `src/*.ts` and this section.

### Search Results (`/s?q=...`)

```
Card container:  article.product-list-card-plp-grid-new
                   data-testid="<ean>"

Product link:    a.product-card-click-wrapper[href*="/p/"]
Product name:    Text format "BRAND  Product Name" (double-space separated)
Price:           .product-price  →  "1 ,15 €"
Unit price:      Inside .product-price, e.g. "1.15 € / L"
Image:           img.product-card-image-new__content
Promo:           .sticker-promo__text  →  "Le 2ème à -50%"
Nutri-Score:     img[alt*="Nutri-Score"]
```

### Product Detail (`/p/<slug>-<ean>`)

```
Title:           h1.product-title__title
Price:           [data-testid="product-price__amount--main"]
Add to cart:     button[aria-label*="Ajouter le produit"][aria-label*="au panier"]
                 (becomes +/- quantity selector after first click)
Nutrition:       #nutritional-details tr
```

### Cart (`/cart/driveclcv`)

```
Item container:  div.product-card-basket[data-testid="<ean>"]
Product name:    .product-card-title__text (h3)
Remove:          button[aria-label*="Supprimer"]
Total:           .checkout-unified-recap__subtotal  →  "Total 2,55 €"
```

## When Selectors Break

Carrefour.fr is a Vue.js SPA with semantic class names (not hashed), so selectors are relatively stable. But the site does get redesigned periodically.

**Quick diagnosis:**

| Symptom | Likely Cause | Fix |
|---|---|---|
| 0 products found | Card class changed | Inspect `article` elements on `/s?q=riz` |
| Name is empty | Title link class changed | Check `.product-card-click-wrapper` |
| Price is 0 | Price element changed | Check `.product-price` |
| Add to cart fails | Button aria-label changed | Check `button[aria-label*="Ajouter"]` |
| Cart throws | Login redirect | Cookies expired — re-login |
| Cloudflare challenge | Anti-bot update | Check `browser.ts` stealth args |
| All pages timeout | DataDome blocking | Ensure `headless: false` and `DISPLAY` set |

**Re-inspect procedure:**

```bash
# Create a quick inspector
cat > /tmp/inspect.mjs << 'EOF'
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://www.carrefour.fr/s?q=riz");
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const cards = document.querySelectorAll("article");
  return {
    count: cards.length,
    classes: cards[0]?.className,
    html: cards[0]?.outerHTML.substring(0, 2000),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
EOF

DISPLAY=:0 node /tmp/inspect.mjs
```

Compare the output with the selectors in `src/search.ts`, update, rebuild, retest.

## Security

- **Credentials** are passed via environment variables, never committed
- **Cookies** stored in `CARREFOUR_DATA_DIR` — treat as sensitive
- **`confirm_and_pay`** is deliberately untested — auto-paying with an AI is dangerous
- The browser runs **non-headless** to avoid bot detection — it appears as a window on your display

## Credits

- Original MCP server by [Maxime Allanic](https://github.com/maximeallanic/mcp-carrefour-drive)
- Selector fixes, tests, and documentation by [Bader](https://github.com/Darkmyter)

## License

[MIT](LICENSE)
