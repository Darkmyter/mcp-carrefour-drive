import { navigateAndWait, getPage } from "./browser.js";
import type { Product, ProductDetails } from "./types.js";

const SEARCH_URL = "https://www.carrefour.fr/s";

export async function searchProducts(query: string, limit: number = 20): Promise<Product[]> {
  const page = await navigateAndWait(`${SEARCH_URL}?q=${encodeURIComponent(query)}`);

  await page.waitForTimeout(3000);

  const products: Product[] = [];
  const productCards = page.locator('[data-testid="product-card"], .product-card, [class*="product-card"], li[data-testid]');
  const count = await productCards.count();

  for (let i = 0; i < Math.min(count, limit); i++) {
    try {
      const card = productCards.nth(i);

      const name = await card.locator('[data-testid="product-card-title"], .product-card__title, h2, h3').first().textContent() || "";
      const priceText = await card.locator('[data-testid="product-card-price"], .product-card__price, [class*="price"]').first().textContent() || "0";
      const brand = await card.locator('[data-testid="product-card-brand"], .product-card__brand, [class*="brand"]').first().textContent().catch(() => "");
      const pricePerUnit = await card.locator('[data-testid="product-card-unit-price"], .product-card__unit-price, [class*="unit-price"]').first().textContent().catch(() => "");
      const image = await card.locator("img").first().getAttribute("src") || "";

      // Check for promotion
      const promo = await card.locator('[class*="promo"], [class*="discount"], [data-testid*="promo"]').first().textContent().catch(() => undefined);

      // Parse price
      const price = parseFloat(priceText.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

      // Get product URL for ID
      const link = await card.locator("a").first().getAttribute("href") || "";
      const id = link.split("/").pop() || `product-${i}`;

      products.push({
        id,
        name: name.trim(),
        brand: (brand || "").trim(),
        price,
        pricePerUnit: (pricePerUnit || "").trim(),
        image,
        available: true,
        promotion: promo?.trim(),
      });
    } catch {
      continue;
    }
  }

  return products;
}

export async function getProductDetails(productUrl: string): Promise<ProductDetails | null> {
  try {
    const url = productUrl.startsWith("http") ? productUrl : `https://www.carrefour.fr${productUrl}`;
    const page = await navigateAndWait(url);

    await page.waitForTimeout(2000);

    const name = await page.locator("h1, [data-testid=\"product-title\"]").first().textContent() || "";
    const priceText = await page.locator('[data-testid="product-price"], [class*="product-price"], [class*="price"]').first().textContent() || "0";
    const price = parseFloat(priceText.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    const brand = await page.locator('[data-testid="product-brand"], [class*="brand"]').first().textContent().catch(() => "");
    const description = await page.locator('[data-testid="product-description"], [class*="description"], .product-description').first().textContent().catch(() => "");
    const ingredients = await page.locator('[data-testid="product-ingredients"], [class*="ingredients"]').first().textContent().catch(() => undefined);
    const image = await page.locator('[data-testid="product-image"] img, .product-image img').first().getAttribute("src") || "";
    const pricePerUnit = await page.locator('[data-testid="product-unit-price"], [class*="unit-price"]').first().textContent().catch(() => "");

    // Nutrition facts
    const nutritionFacts: Record<string, string> = {};
    const nutritionRows = page.locator('[class*="nutrition"] tr, [data-testid*="nutrition"] tr');
    const nutritionCount = await nutritionRows.count();
    for (let i = 0; i < nutritionCount; i++) {
      const row = nutritionRows.nth(i);
      const cells = row.locator("td, th");
      if (await cells.count() >= 2) {
        const key = await cells.nth(0).textContent() || "";
        const value = await cells.nth(1).textContent() || "";
        if (key.trim()) nutritionFacts[key.trim()] = value.trim();
      }
    }

    // Allergens
    const allergensText = await page.locator('[data-testid="product-allergens"], [class*="allergen"]').first().textContent().catch(() => "");
    const allergens = allergensText ? allergensText.split(/[,;]/).map((a) => a.trim()).filter(Boolean) : undefined;

    return {
      id: productUrl.split("/").pop() || "",
      name: name.trim(),
      brand: (brand || "").trim(),
      price,
      pricePerUnit: (pricePerUnit || "").trim(),
      image,
      available: true,
      description: (description || "").trim(),
      ingredients: ingredients?.trim(),
      nutritionFacts: Object.keys(nutritionFacts).length > 0 ? nutritionFacts : undefined,
      allergens,
    };
  } catch {
    return null;
  }
}
