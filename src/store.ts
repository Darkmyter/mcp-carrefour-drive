import { getPage, saveCookies, navigateAndWait } from "./browser.js";
import type { Store } from "./types.js";

// Carrefour uses a store finder at /magasin or /magasin/liste
const STORE_FINDER_URL = "https://www.carrefour.fr/magasin";

export async function searchStores(postalCode: string): Promise<Store[]> {
  const page = await navigateAndWait(STORE_FINDER_URL);
  await page.waitForTimeout(3000);

  // Look for the store search input on the magasin page
  // The page may have a geolocation/search input
  const searchInput = page.locator(
    'input[placeholder*="Rechercher"], input[placeholder*="code postal"], input[placeholder*="ville"], input[name*="search"], input[type="search"]'
  ).first();

  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.fill(postalCode);
    await searchInput.press("Enter");
    await page.waitForTimeout(3000);
  }

  // Extract store results — try various selectors
  const stores: Store[] = [];
  const storeCards = page.locator(
    'article, [class*="store-card"], [class*="magasin-card"], [data-testid*="store"], [class*="store-result"]'
  );
  const count = await storeCards.count();

  for (let i = 0; i < Math.min(count, 10); i++) {
    try {
      const card = storeCards.nth(i);
      const name = await card.locator("h2, h3, [class*='name'], [class*='title']").first().textContent() || "";
      const address = await card.locator("[class*='address'], [class*='adresse'], p").first().textContent() || "";

      stores.push({
        id: `store-${i}`,
        name: name.trim(),
        address: address.trim(),
        postalCode,
        city: "",
        type: name.toLowerCase().includes("drive") ? "drive" : "magasin",
      });
    } catch {
      continue;
    }
  }

  return stores;
}

export async function selectStore(storeIndex: number): Promise<{ success: boolean; message: string }> {
  try {
    const page = await getPage();
    const storeCards = page.locator(
      'article, [class*="store-card"], [class*="magasin-card"], [data-testid*="store"]'
    );
    const card = storeCards.nth(storeIndex);

    // Click on "Choisir ce magasin" or similar button
    const selectBtn = card.locator('button, a').filter({ hasText: /choisir|sélectionner|drive|retirer/i }).first();
    await selectBtn.click();
    await page.waitForTimeout(3000);
    await saveCookies();

    return { success: true, message: "Magasin sélectionné" };
  } catch (error: any) {
    return { success: false, message: `Échec sélection magasin : ${error.message}` };
  }
}

export async function selectStoreByPostalCode(postalCode: string, storeName?: string): Promise<{ success: boolean; message: string; stores?: Store[] }> {
  const stores = await searchStores(postalCode);

  if (stores.length === 0) {
    return { success: false, message: "Aucun magasin trouvé" };
  }

  // If a name filter is given, find the matching store
  if (storeName) {
    const idx = stores.findIndex(
      (s) => s.name.toLowerCase().includes(storeName.toLowerCase())
    );
    if (idx >= 0) {
      const result = await selectStore(idx);
      return { ...result, stores };
    }
    return { success: false, message: `Magasin "${storeName}" non trouvé. Magasins disponibles :`, stores };
  }

  // Default: select first drive
  const driveIdx = stores.findIndex((s) => s.type === "drive");
  if (driveIdx >= 0) {
    const result = await selectStore(driveIdx);
    return { ...result, stores };
  }

  return { success: false, message: "Aucun Drive trouvé, voici les magasins :", stores };
}
