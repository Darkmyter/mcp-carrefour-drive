import { getPage, saveCookies, navigateAndWait } from "./browser.js";
import type { Cart, CartItem, Product } from "./types.js";

const CART_URL = "https://www.carrefour.fr/cart/driveclcv";

export async function addToCart(productId: string, quantity: number = 1): Promise<{ success: boolean; message: string }> {
  try {
    const url = productId.startsWith("http")
      ? productId
      : `https://www.carrefour.fr/p/${productId}`;

    const page = await navigateAndWait(url);

    // Wait for the add-to-cart button
    await page.waitForSelector('button[aria-label*="Ajouter le produit"][aria-label*="au panier"]', { timeout: 10000 })
      .catch(() => {});

    // Click the "Acheter" button
    const addBtn = page.locator('button[aria-label*="Ajouter le produit"][aria-label*="au panier"]').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
    } else {
      // Fallback: click the first button inside .add-to-cart
      await page.locator(".add-to-cart button").first().click();
    }
    await page.waitForTimeout(2000);

    // Increment quantity if needed
    for (let i = 1; i < quantity; i++) {
      const plusBtn = page.locator('button[aria-label*="augmenter"]').first();
      if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await plusBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await saveCookies();
    return { success: true, message: `${quantity}x produit ajouté au panier` };
  } catch (error: any) {
    return { success: false, message: `Échec ajout au panier : ${error.message}` };
  }
}

export async function removeFromCart(productId: string): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(CART_URL);
    await page.waitForTimeout(2000);

    // Find and click remove button for the product
    const removed = await page.evaluate((pid: string) => {
      // Find the cart item by data-testid or by link
      const items = document.querySelectorAll(".product-card-basket");
      for (const item of items) {
        const link = item.querySelector("a[href*='/p/']")?.getAttribute("href") || "";
        const testId = item.getAttribute("data-testid") || "";
        if (link.includes(pid) || testId === pid) {
          const removeBtn = item.querySelector('button[aria-label*="Supprimer"]') as HTMLButtonElement;
          if (removeBtn) {
            removeBtn.click();
            return true;
          }
        }
      }
      return false;
    }, productId);

    if (removed) {
      await page.waitForTimeout(2000);
      await saveCookies();
      return { success: true, message: "Produit retiré du panier" };
    }
    return { success: false, message: "Produit non trouvé dans le panier" };
  } catch (error: any) {
    return { success: false, message: `Échec suppression : ${error.message}` };
  }
}

export async function getCart(): Promise<Cart> {
  const page = await navigateAndWait(CART_URL);
  await page.waitForTimeout(2000);

  // Extract all cart data in one evaluate call
  const data = await page.evaluate(() => {
    const items: any[] = [];
    const cartItems = document.querySelectorAll(".product-card-basket");

    cartItems.forEach((item, i) => {
      try {
        const link = item.querySelector("a[href*='/p/']")?.getAttribute("href") || "";
        const id = link.split("/").pop() || `item-${i}`;
        const name = item.querySelector(".product-card-title__text, h3")?.textContent?.trim() || "";
        const priceText = item.querySelector("[class*='price'], .amount-display")?.textContent || "0";
        const qtyText = item.querySelector(".quantity-counter__value")?.textContent?.trim() || "1";

        items.push({ id, name, priceText, quantityText: qtyText });
      } catch {}
    });

    const totalText = document.querySelector(".checkout-unified-recap__subtotal")?.textContent || "0";

    return { items, totalText };
  });

  const parsePrice = (text: string) => {
    const cleaned = text.replace(/[^\d.,]/g, "");
    if (!cleaned) return 0;
    if (cleaned.includes(",")) return parseFloat(cleaned.replace(/,/g, ".")) || 0;
    return parseFloat(cleaned) || 0;
  };

  const cartItems: CartItem[] = data.items.map((item: any) => {
    const price = parsePrice(item.priceText);
    const quantity = parseInt(item.quantityText) || 1;
    return {
      product: {
        id: item.id,
        name: item.name,
        brand: "",
        price,
        pricePerUnit: "",
        image: "",
        available: true,
      },
      quantity,
      subtotal: price * quantity,
    };
  });

  return {
    items: cartItems,
    totalItems: cartItems.reduce((sum, i) => sum + i.quantity, 0),
    totalPrice: parsePrice(data.totalText),
  };
}

export async function updateCartItemQuantity(productId: string, quantity: number): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(CART_URL);
    await page.waitForTimeout(2000);

    // Find the item and update quantity using +/- buttons
    const result = await page.evaluate(({ pid }: { pid: string }) => {
      const items = document.querySelectorAll(".product-card-basket");
      for (const item of items) {
        const link = item.querySelector("a[href*='/p/']")?.getAttribute("href") || "";
        const testId = item.getAttribute("data-testid") || "";
        if (link.includes(pid) || testId === pid) {
          const qtyEl = item.querySelector(".quantity-counter__value");
          const currentQty = parseInt(qtyEl?.textContent?.trim() || "1") || 1;
          return { found: true, currentQty };
        }
      }
      return { found: false, currentQty: 0 };
    }, { pid: productId });

    if (!result.found) {
      return { success: false, message: "Produit non trouvé dans le panier" };
    }

    // Click +/- buttons to reach target quantity
    const cartItem = page.locator(`.product-card-basket`).filter({
      has: page.locator(`a[href*="${productId}"]`)
    }).first();

    if (quantity > result.currentQty) {
      const plusBtn = cartItem.locator('button[aria-label*="augmenter"]').first();
      for (let i = result.currentQty; i < quantity; i++) {
        await plusBtn.click();
        await page.waitForTimeout(500);
      }
    } else if (quantity < result.currentQty) {
      const minusBtn = cartItem.locator('button[aria-label*="diminuer"]').first();
      for (let i = result.currentQty; i > quantity; i--) {
        await minusBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await saveCookies();
    return { success: true, message: `Quantité mise à jour : ${quantity}` };
  } catch (error: any) {
    return { success: false, message: `Échec mise à jour quantité : ${error.message}` };
  }
}
