import { navigateAndWait, getPage, saveCookies } from "./browser.js";

const CHECKOUT_URL = "https://www.carrefour.fr/mon-panier/validation";

export interface CheckoutSummary {
  items: number;
  totalPrice: string;
  deliverySlot: string;
  paymentMethod: string;
  store: string;
}

export async function getCheckoutSummary(): Promise<{ success: boolean; summary?: CheckoutSummary; message: string }> {
  try {
    const page = await navigateAndWait(CHECKOUT_URL);
    await page.waitForTimeout(3000);

    // Check if we can see the checkout page
    const url = page.url();
    if (url.includes("connexion")) {
      return { success: false, message: "Non connecté. Utilisez login d'abord." };
    }

    // Extract summary info
    const totalPrice = await page.locator('[data-testid="order-total"], [class*="total-price"], [class*="order-total"]').first().textContent().catch(() => "inconnu");
    const deliverySlot = await page.locator('[data-testid="delivery-slot"], [class*="slot-summary"], [class*="delivery-time"]').first().textContent().catch(() => "non sélectionné");
    const paymentMethod = await page.locator('[data-testid="payment-method"], [class*="payment-method"], [class*="payment-card"]').first().textContent().catch(() => "aucun");
    const store = await page.locator('[data-testid="store-name"], [class*="store-name"]').first().textContent().catch(() => "inconnu");

    return {
      success: true,
      summary: {
        items: 0, // Will be extracted from page
        totalPrice: (totalPrice || "inconnu").trim(),
        deliverySlot: (deliverySlot || "non sélectionné").trim(),
        paymentMethod: (paymentMethod || "aucun").trim(),
        store: (store || "inconnu").trim(),
      },
      message: "Résumé de commande récupéré",
    };
  } catch (error: any) {
    return { success: false, message: `Échec récupération résumé : ${error.message}` };
  }
}

export async function confirmAndPay(): Promise<{ success: boolean; message: string; orderNumber?: string }> {
  try {
    const page = await navigateAndWait(CHECKOUT_URL);
    await page.waitForTimeout(3000);

    // Check if we're on the checkout page
    if (page.url().includes("connexion")) {
      return { success: false, message: "Non connecté. Utilisez login d'abord." };
    }

    // Verify a payment method exists
    const paymentMethod = await page.locator('[data-testid="payment-method"], [class*="payment-method"], [class*="payment-card"], [class*="saved-card"]').first().textContent().catch(() => "");
    if (!paymentMethod || paymentMethod.includes("ajouter") || paymentMethod.includes("Ajouter")) {
      return { success: false, message: "Aucun moyen de paiement enregistré sur le compte. Ajoutez une carte sur carrefour.fr d'abord." };
    }

    // Check that a delivery slot is selected
    const slot = await page.locator('[data-testid="delivery-slot"], [class*="slot-summary"], [class*="delivery-time"]').first().textContent().catch(() => "");
    if (!slot || slot.includes("choisir") || slot.includes("Choisir")) {
      return { success: false, message: "Aucun créneau de retrait sélectionné. Utilisez select_slot d'abord." };
    }

    // Accept CGV if checkbox exists
    const cgvCheckbox = page.locator('input[type="checkbox"][name*="cgv"], input[type="checkbox"][name*="terms"], input[id*="cgv"]').first();
    if (await cgvCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cgvCheckbox.check();
      await page.waitForTimeout(500);
    }

    // Click the final "Payer" / "Confirmer" button
    const payBtn = page.locator('button').filter({ hasText: /payer|confirmer.*commande|valider.*commande|finaliser/i }).first();

    if (!await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      return { success: false, message: "Bouton de paiement non trouvé. Vérifiez que le panier, le créneau et le moyen de paiement sont bien configurés." };
    }

    await payBtn.click();
    await page.waitForTimeout(5000);

    // Check for 3D Secure or additional validation
    const currentUrl = page.url();
    if (currentUrl.includes("3dsecure") || currentUrl.includes("secure")) {
      return { success: false, message: "Authentification 3D Secure requise. Validez manuellement sur le site." };
    }

    // Try to extract order confirmation
    const confirmationText = await page.locator('[data-testid="order-confirmation"], [class*="confirmation"], [class*="order-number"], h1').first().textContent().catch(() => "");

    // Extract order number if visible
    const orderNumberMatch = confirmationText?.match(/(\d{10,})/);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : undefined;

    await saveCookies();

    if (confirmationText && (confirmationText.toLowerCase().includes("confirm") || confirmationText.toLowerCase().includes("merci") || confirmationText.toLowerCase().includes("validé"))) {
      return {
        success: true,
        message: `Commande confirmée ! ${orderNumber ? `N° ${orderNumber}` : ""}`,
        orderNumber,
      };
    }

    // If we're not sure, check the page for errors
    const errorText = await page.locator('[class*="error"], [data-testid*="error"], .alert-danger').first().textContent().catch(() => "");
    if (errorText) {
      return { success: false, message: `Erreur lors du paiement : ${errorText.trim()}` };
    }

    return { success: true, message: "Paiement soumis. Vérifiez votre email pour la confirmation.", orderNumber };
  } catch (error: any) {
    return { success: false, message: `Échec paiement : ${error.message}` };
  }
}
