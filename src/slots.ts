import { navigateAndWait, saveCookies } from "./browser.js";
import type { DeliverySlot } from "./types.js";

const SLOTS_URL = "https://www.carrefour.fr/mon-panier/creneaux";

export async function getAvailableSlots(): Promise<DeliverySlot[]> {
  const page = await navigateAndWait(SLOTS_URL);
  await page.waitForTimeout(3000);

  const slots: DeliverySlot[] = [];

  // Carrefour shows slots in a calendar-like view
  const slotElements = page.locator('[data-testid="slot"], .slot, [class*="slot"], button[class*="creneau"]');
  const count = await slotElements.count();

  for (let i = 0; i < count; i++) {
    try {
      const slot = slotElements.nth(i);
      const text = await slot.textContent() || "";
      const isAvailable = !(await slot.getAttribute("disabled"));
      const ariaLabel = await slot.getAttribute("aria-label") || text;

      // Try to extract date and time from the slot
      const dateMatch = ariaLabel.match(/(\d{1,2})\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
      const timeMatch = ariaLabel.match(/(\d{1,2}h\d{0,2})\s*-\s*(\d{1,2}h\d{0,2})/);

      slots.push({
        id: `slot-${i}`,
        date: dateMatch ? dateMatch[0] : text.trim().substring(0, 20),
        timeRange: timeMatch ? timeMatch[0] : text.trim(),
        available: isAvailable !== null,
        price: undefined,
      });
    } catch {
      continue;
    }
  }

  return slots;
}

export async function selectSlot(slotId: string): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(SLOTS_URL);
    await page.waitForTimeout(3000);

    const index = parseInt(slotId.replace("slot-", ""));
    const slotElements = page.locator('[data-testid="slot"], .slot, [class*="slot"], button[class*="creneau"]');
    const slot = slotElements.nth(index);

    await slot.click();
    await page.waitForTimeout(2000);

    // Confirm the selection if there's a confirm button
    const confirmBtn = page.locator('button').filter({ hasText: /confirmer|valider/i }).first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    await saveCookies();
    return { success: true, message: "Créneau sélectionné" };
  } catch (error: any) {
    return { success: false, message: `Échec sélection créneau : ${error.message}` };
  }
}
