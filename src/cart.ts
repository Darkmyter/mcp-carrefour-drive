import { getPage, saveCookies, navigateAndWait } from "./browser.js";
import type { Cart, CartItem, Product } from "./types.js";

const CART_URL = "https://www.carrefour.fr/mon-panier";

export async function addToCart(productId: string, quantity: number = 1): Promise<{ success: boolean; message: string }> {
  try {
    // Navigate to the product page
    const url = productId.startsWith("http")
      ? productId
      : `https://www.carrefour.fr/p/${productId}`;

    const page = await navigateAndWait(url);
    await page.waitForTimeout(2000);

    // Click "Ajouter" button
    const addBtn = page.locator('button').filter({ hasText: /ajouter|add/i }).first();
    await addBtn.click();
    await page.waitForTimeout(1500);

    // If quantity > 1, increment
    for (let i = 1; i < quantity; i++) {
      const plusBtn = page.locator('button[aria-label*="augmenter"], button[aria-label*="plus"], button[data-testid*="increment"], .quantity-selector button:last-child').first();
      await plusBtn.click();
      await page.waitForTimeout(500);
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
    await page.waitForTimeout(3000);

    // Find the product in the cart and remove it
    const cartItems = page.locator('[data-testid="cart-item"], .cart-item, [class*="cart-item"]');
    const count = await cartItems.count();

    for (let i = 0; i < count; i++) {
      const item = cartItems.nth(i);
      const link = await item.locator("a").first().getAttribute("href").catch(() => "");
      if (link && link.includes(productId)) {
        const removeBtn = item.locator('button[aria-label*="supprimer"], button[aria-label*="retirer"], button[data-testid*="remove"], button[data-testid*="delete"]').first();
        await removeBtn.click();
        await page.waitForTimeout(1500);
        await saveCookies();
        return { success: true, message: "Produit retiré du panier" };
      }
    }

    return { success: false, message: "Produit non trouvé dans le panier" };
  } catch (error: any) {
    return { success: false, message: `Échec suppression : ${error.message}` };
  }
}

export async function getCart(): Promise<Cart> {
  const page = await navigateAndWait(CART_URL);
  await page.waitForTimeout(3000);

  const items: CartItem[] = [];
  const cartItems = page.locator('[data-testid="cart-item"], .cart-item, [class*="cart-item"]');
  const count = await cartItems.count();

  for (let i = 0; i < count; i++) {
    try {
      const item = cartItems.nth(i);
      const name = await item.locator('[data-testid="cart-item-name"], .cart-item__name, h2, h3, a').first().textContent() || "";
      const priceText = await item.locator('[data-testid="cart-item-price"], .cart-item__price, [class*="price"]').first().textContent() || "0";
      const quantityText = await item.locator('input[type="number"], [data-testid="cart-item-quantity"], .quantity-selector input').first().inputValue().catch(() => "1");
      const link = await item.locator("a").first().getAttribute("href") || "";

      const price = parseFloat(priceText.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
      const quantity = parseInt(quantityText) || 1;

      items.push({
        product: {
          id: link.split("/").pop() || `item-${i}`,
          name: name.trim(),
          brand: "",
          price,
          pricePerUnit: "",
          image: "",
          available: true,
        },
        quantity,
        subtotal: price * quantity,
      });
    } catch {
      continue;
    }
  }

  // Get total
  const totalText = await page.locator('[data-testid="cart-total"], .cart-total, [class*="total-price"]').first().textContent().catch(() => "0");
  const totalPrice = parseFloat((totalText || "0").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

  return {
    items,
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
    totalPrice,
  };
}

export async function updateCartItemQuantity(productId: string, quantity: number): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(CART_URL);
    await page.waitForTimeout(3000);

    const cartItems = page.locator('[data-testid="cart-item"], .cart-item, [class*="cart-item"]');
    const count = await cartItems.count();

    for (let i = 0; i < count; i++) {
      const item = cartItems.nth(i);
      const link = await item.locator("a").first().getAttribute("href").catch(() => "");
      if (link && link.includes(productId)) {
        const quantityInput = item.locator('input[type="number"], .quantity-selector input').first();
        await quantityInput.fill(String(quantity));
        await quantityInput.press("Enter");
        await page.waitForTimeout(1500);
        await saveCookies();
        return { success: true, message: `Quantité mise à jour : ${quantity}` };
      }
    }

    return { success: false, message: "Produit non trouvé dans le panier" };
  } catch (error: any) {
    return { success: false, message: `Échec mise à jour quantité : ${error.message}` };
  }
}
