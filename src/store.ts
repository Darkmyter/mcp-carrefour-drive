import { getPage, saveCookies, navigateAndWait } from "./browser.js";
import type { Store } from "./types.js";

const STORE_SEARCH_URL = "https://www.carrefour.fr/magasin/recherche";

export async function searchStores(postalCode: string): Promise<Store[]> {
  const page = await navigateAndWait(STORE_SEARCH_URL);

  // Type postal code in search
  const searchInput = page.locator('input[placeholder*="ville"], input[placeholder*="code postal"], input[name="search"], input[type="search"]').first();
  await searchInput.fill(postalCode);
  await searchInput.press("Enter");

  await page.waitForTimeout(3000);

  // Extract store results
  const stores: Store[] = [];
  const storeCards = page.locator('[data-testid="store-card"], .store-card, .store-result, article');
  const count = await storeCards.count();

  for (let i = 0; i < Math.min(count, 10); i++) {
    try {
      const card = storeCards.nth(i);
      const name = await card.locator("h2, h3, .store-name, [data-testid=\"store-name\"]").first().textContent() || "";
      const address = await card.locator(".address, .store-address, [data-testid=\"store-address\"]").first().textContent() || "";

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
    const storeCards = page.locator('[data-testid="store-card"], .store-card, .store-result, article');
    const card = storeCards.nth(storeIndex);

    // Click on "Choisir ce magasin" or similar button
    const selectBtn = card.locator('button, a').filter({ hasText: /choisir|sélectionner|drive/i }).first();
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
