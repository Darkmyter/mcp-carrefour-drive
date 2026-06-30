import { navigateAndWait, getPage } from "./browser.js";
import type { Product, ProductDetails } from "./types.js";

const SEARCH_URL = "https://www.carrefour.fr/s";

export async function searchProducts(query: string, limit: number = 20): Promise<Product[]> {
  const page = await navigateAndWait(`${SEARCH_URL}?q=${encodeURIComponent(query)}`);

  // Wait for product cards to appear (up to 15s)
  await page.waitForSelector("article.product-list-card-plp-grid-new", { timeout: 15000 }).catch(() => {});
  // Give Vue hydration a moment to populate text content
  await page.waitForTimeout(1000);

  // Extract all product data in a single evaluate call (much faster than per-element locators)
  const products = await page.evaluate((max: number) => {
    const cards = document.querySelectorAll("article.product-list-card-plp-grid-new");
    const results: any[] = [];

    for (let i = 0; i < Math.min(cards.length, max); i++) {
      try {
        const card = cards[i];

        // Product link — use the specific title container link, not any /p/ link
        const linkEl = card.querySelector(
          "a.product-card-click-wrapper[href*='/p/'], a.product-list-card-plp-grid-new__title-container[href*='/p/']"
        ) || card.querySelector("a[href*='/p/']");
        const href = linkEl?.getAttribute("href") || "";
        const id = href.split("/").pop() || `product-${i}`;

        // Product name: try the title container first, then the link text, then img alt
        const titleEl = card.querySelector(
          "a.product-card-click-wrapper, a.product-list-card-plp-grid-new__title-container"
        );
        let fullText = (titleEl?.textContent || "").trim();
        // Also try img alt text as fallback
        if (!fullText) {
          const imgEl = card.querySelector("img") as HTMLImageElement;
          const alt = imgEl?.alt || "";
          if (alt.startsWith("image: ")) fullText = alt.substring(7);
          else fullText = alt;
        }
        const parts = fullText.split(/\s{2,}/);
        const brand = parts.length > 1 ? parts[0].trim() : "";
        const name = parts.length > 1 ? parts.slice(1).join(" ").trim() : fullText;

        // Price
        const priceEl = card.querySelector(".product-price");
        const priceText = priceEl?.textContent || "0";

        // Image
        const imgEl = card.querySelector("img.product-card-image-new__content, img.product-card-image-new__placeholder") as HTMLImageElement;
        const image = imgEl?.src || "";

        // Promo
        const promoEl = card.querySelector(".sticker-promo__text");
        const promo = promoEl?.textContent?.trim() || undefined;

        results.push({ id, name, brand, priceText, image, promo });
      } catch {
        continue;
      }
    }
    return results;
  }, limit);

  // Parse prices on the Node side
  return products.map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: parsePrice(p.priceText),
    pricePerUnit: "",
    image: p.image,
    available: true,
    promotion: p.promo,
  }));
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(/,/g, ".")) || 0;
  return parseFloat(cleaned) || 0;
}

export async function getProductDetails(productUrl: string): Promise<ProductDetails | null> {
  try {
    const url = productUrl.startsWith("http") ? productUrl : `https://www.carrefour.fr${productUrl}`;
    const page = await navigateAndWait(url);

    // Wait for product title or any content
    await page.waitForSelector("h1.product-title__title", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Extract all details in one evaluate call
    const data = await page.evaluate(() => {
      const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() || "";
      const getAttr = (sel: string, attr: string) => document.querySelector(sel)?.getAttribute(attr) || "";

      // Price
      const priceEl = document.querySelector('[data-testid="product-price__amount--main"]');
      const priceText = priceEl?.textContent || "0";

      // Nutrition
      const nutritionFacts: Record<string, string> = {};
      const rows = document.querySelectorAll("#nutritional-details tr, .nutritional-details tr");
      rows.forEach(row => {
        const cells = row.querySelectorAll("td, th");
        if (cells.length >= 2) {
          const key = cells[0].textContent?.trim() || "";
          const value = cells[1].textContent?.trim() || "";
          if (key) nutritionFacts[key] = value;
        }
      });

      return {
        name: getText("h1.product-title__title"),
        priceText,
        brand: getText(".product-title__brand, .brand-name"),
        description: getText(".product-description, .main-details__description"),
        image: getAttr(".product-image img, .product-zoom img", "src"),
        pricePerUnit: getText(".product-price__per-unit, [class*='per-unit']"),
        ingredients: getText("[class*='ingredient'] p, .highlighted-section-card__content"),
        allergensText: getText("[class*='allergen']"),
        nutritionFacts,
      };
    });

    const allergens = data.allergensText
      ? data.allergensText.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean)
      : undefined;

    return {
      id: productUrl.split("/").pop() || "",
      name: data.name,
      brand: data.brand,
      price: parsePrice(data.priceText),
      pricePerUnit: data.pricePerUnit,
      image: data.image,
      available: true,
      description: data.description,
      ingredients: data.ingredients || undefined,
      nutritionFacts: Object.keys(data.nutritionFacts).length > 0 ? data.nutritionFacts : undefined,
      allergens,
    };
  } catch {
    return null;
  }
}
