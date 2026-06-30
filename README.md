# mcp-carrefour-drive

MCP server for Carrefour Drive — search products, manage cart, check slots, and order groceries via AI assistants.

Forked from [maximeallanic/mcp-carrefour-drive](https://github.com/maximeallanic/mcp-carrefour-drive) with fixed selectors for the real Carrefour.fr DOM and automated tests.

## Quick Start

```bash
cd ~/mcp-carrefour-drive-fork
npm install
npm run build

# Run unit tests (no browser)
npm run test

# Run E2E tests (requires visible browser + DISPLAY=:0)
DISPLAY=:0 CARREFOUR_DATA_DIR=~/.carrefour-mcp npm run test:e2e
```

## Architecture

```
src/
├── index.ts       # MCP server entry — registers all tools with zod schemas
├── browser.ts     # Playwright launcher — non-headless, stealth, cookie persistence
├── auth.ts        # login / logout / isLoggedIn via carrefour.fr SSO
├── search.ts      # searchProducts / getProductDetails
├── cart.ts        # addToCart / removeFromCart / getCart / updateCartItemQuantity
├── store.ts       # searchStores / selectStore / selectStoreByPostalCode
├── slots.ts       # getAvailableSlots / selectSlot (untested)
├── checkout.ts    # getCheckoutSummary / confirmAndPay (untested)
└── types.ts       # Product, Cart, Store, DeliverySlot interfaces
```

All page interactions use a **single `page.evaluate()` call** per operation (not per-element locators) for speed. The original code used per-element Playwright locators which caused 30s+ timeouts; the evaluate approach completes in 2–3s.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CARREFOUR_EMAIL` | Yes | — | Carrefour account email |
| `CARREFOUR_PASSWORD` | Yes | — | Carrefour account password |
| `DISPLAY` | Yes | — | X11 display (e.g. `:0`). DataDome blocks headless browsers. |
| `CARREFOUR_DATA_DIR` | No | `~/.carrefour-mcp` | Cookie storage directory |

## MCP Tools

| Tool | Status | Description |
|---|---|---|
| `search_products` | ✅ Working | Search by query, returns name/brand/price/image/promo |
| `get_product_details` | ✅ Working | Full product page: price, nutrition, ingredients, allergens |
| `add_to_cart` | ✅ Working | Navigate to product page and click "Acheter" |
| `get_cart` | ✅ Working | Extract cart items and total from /cart/driveclcv |
| `remove_from_cart` | ✅ Working | Click "Supprimer" button for matching item |
| `update_cart_quantity` | ⚠️ Untested | Uses +/- buttons, may need testing |
| `check_login` | ✅ Working | Returns true/false |
| `login` | ⚠️ Partial | Form fill works, but SSO redirect may need handling |
| `select_store` | ⚠️ Partial | /magasin page has limited store search |
| `get_available_slots` | ❌ Untested | May need selector fixes |
| `select_slot` | ❌ Untested | May need selector fixes |
| `get_checkout_summary` | ❌ Untested | May need selector fixes |
| `confirm_and_pay` | ❌ Untested | Deliberately — don't auto-pay |

## Carrefour.fr DOM Reference

This is the **source of truth** for selectors. If the website changes, re-run the DOM inspector (see below) and update `src/*.ts`.

### Search Results Page (`/s?q=...`)

```
URL pattern: https://www.carrefour.fr/s?q=<query>

Product card container:
  article.product-list-card-plp-grid-new
    data-testid="<ean>"           ← product EAN as test ID

Inside each card:
  Product link + name:
    a.product-card-click-wrapper[href*="/p/"]
    a.product-list-card-plp-grid-new__title-container
    Text format: "BRAND  Product Name"  (double-space separated)

  Price:
    .product-price → text like "1 ,15 €"
    Has modifier class .product-price--promo when on sale

  Unit price (per kg/L):
    Inside .product-price area, e.g. "1.15 € / L"

  Image:
    img.product-card-image-new__content
    img.product-card-image-new__placeholder (before load)

  Promo badge:
    .sticker-promo__text → e.g. "Le 2ème à -50%"

  Nutri-Score:
    img[alt*="Nutri-Score"] → e.g. "Nutri-Score: A"

  Quantity tag:
    button.c-tag → e.g. "1L", "6x1l"
```

### Product Detail Page (`/p/<slug>-<ean>`)

```
URL pattern: https://www.carrefour.fr/p/<product-slug>-<ean>

Title:
  h1.product-title__title

Price:
  [data-testid="product-price__amount--main"]
  Parent: .product-price__amount

Add to cart button:
  button[aria-label*="Ajouter le produit"][aria-label*="au panier"]
  Text: "Acheter"
  Parent: .add-to-cart → .quantity-button

After adding, button becomes quantity selector with +/- buttons:
  button[aria-label*="augmenter"]  (increment)
  button[aria-label*="diminuer"]   (decrement)
  .quantity-counter__value         (current qty)

Nutrition facts:
  #nutritional-details / .nutritional-details
  Table rows: #nutritional-details tr

Delivery mode selector:
  button[data-testid*="pill-group"] → Drive / Livraison / Livraison Express
```

### Cart Page (`/cart/driveclcv`)

```
URL: https://www.carrefour.fr/cart/driveclcv
(redirects to login if not authenticated)

Cart item container:
  div.product-card-basket
    data-testid="<ean>"

Inside each item:
  Product image + link:
    a.product-card-basket__image[href*="/p/"]
    data-testid="product-card-image"

  Product name:
    .product-card-title__text (h3)

  Remove button (two variants):
    button[aria-label*="Supprimer ... du panier"]  (text link style)
    button[aria-label*="Retirer ..."]              (icon button)

  Quantity:
    .quantity-counter__value

Cart total:
  .checkout-unified-recap__subtotal → "Total 2,55 €"

Cart URL pattern: /cart/driveclcv
  "driveclcv" = Drive CLCV delivery type
```

### Login Page (`/mon-compte/connexion`)

```
Email input:  input[type="email"], input[name="email"], #email
Password:     input[type="password"]
Submit:       button[type="submit"]
After login:  URL changes away from /connexion
SSO:          May redirect to moncompte.carrefour.fr (OpenAM)
```

### Store Finder (`/magasin`)

```
The store page at /magasin/recherche does NOT have a dedicated store search input.
Store selection is handled through:
  - The site-wide search bar (input.c-base-input__input)
  - Geolocation popup on first visit
  - Cookie-based store preference

Links found on homepage:
  /magasin          → "Trouver votre magasin le plus proche"
  /magasin/liste    → "Tous les magasins"
```

## When Selectors Break

Carrefour.fr is a Vue.js SPA. Class names are semantic (not hashed), so they're relatively stable, but the site does get redesigned periodically.

### Re-inspection Procedure

1. Run the DOM inspector script (or create a new one):

```javascript
// inspect.mjs — run with: DISPLAY=:0 node inspect.mjs
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://www.carrefour.fr/s?q=riz");
await page.waitForTimeout(5000);

// Check what selectors still work
const info = await page.evaluate(() => {
  const cards = document.querySelectorAll("article");
  return {
    cardCount: cards.length,
    firstCardClasses: cards[0]?.className,
    firstCardHTML: cards[0]?.outerHTML.substring(0, 2000),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
```

2. Compare with the selectors in `src/search.ts`, `src/cart.ts`, etc.
3. Update the selectors in the source code
4. Run `npm run build && npm run test:e2e` to verify
5. Update this document's DOM Reference section

### Common Breakage Patterns

| Symptom | Likely Cause | Fix |
|---|---|---|
| Search returns 0 products | Card class changed | Re-inspect `article` elements |
| Product name empty | Title link class changed | Check `.product-card-click-wrapper` |
| Price is 0 | Price element class changed | Check `.product-price` |
| Add to cart fails | Button aria-label changed | Check `button[aria-label*="Ajouter"]` |
| Cart page throws | Login redirect | Refresh cookies, check auth |
| Cloudflare challenge | Anti-bot update | Check browser.ts stealth args |
| Timeout on all pages | DataDome blocking | Ensure `headless: false` + DISPLAY set |

## Security Notes

- **Never commit credentials** — `CARREFOUR_EMAIL` and `CARREFOUR_PASSWORD` are in `~/.hermes/config.yaml`, not in this repo
- **Cookies** are stored in `~/.carrefour-mcp/cookies.json` — treat as sensitive
- **`confirm_and_pay`** is intentionally untested — auto-paying is dangerous
- The browser runs non-headless to avoid bot detection — it will appear on the X display

## Publishing

No GitHub remote yet. To create one:

```bash
cd ~/mcp-carrefour-drive-fork
gh auth login
gh repo create mcp-carrefour-drive --public --source=. --push
```

To propose changes upstream:

```bash
git remote add upstream https://github.com/maximeallanic/mcp-carrefour-drive.git
git fetch upstream
# Create a PR via GitHub UI
```
