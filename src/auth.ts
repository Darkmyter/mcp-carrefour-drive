import { getPage, saveCookies, navigateAndWait } from "./browser.js";

const LOGIN_URL = "https://www.carrefour.fr/mon-compte/connexion";
const ACCOUNT_URL = "https://www.carrefour.fr/mon-compte";

export async function login(email: string, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(LOGIN_URL);

    // Check if already logged in
    const accountLink = page.locator('[data-testid="header-my-account-logged"]');
    if (await accountLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveCookies();
      return { success: true, message: "Déjà connecté" };
    }

    // Fill login form
    await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });

    const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first();
    await passwordInput.fill(password);

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for navigation
    await page.waitForURL((url) => !url.href.includes("connexion"), { timeout: 15000 });

    await saveCookies();
    return { success: true, message: "Connexion réussie" };
  } catch (error: any) {
    return { success: false, message: `Échec connexion : ${error.message}` };
  }
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    const page = await navigateAndWait(ACCOUNT_URL);
    // If we stay on the account page, we're logged in
    return !page.url().includes("connexion");
  } catch {
    return false;
  }
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait("https://www.carrefour.fr/mon-compte/deconnexion");
    await saveCookies();
    return { success: true, message: "Déconnecté" };
  } catch (error: any) {
    return { success: false, message: `Échec déconnexion : ${error.message}` };
  }
}
