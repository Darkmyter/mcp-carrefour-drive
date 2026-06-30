import { getPage, saveCookies, navigateAndWait } from "./browser.js";

const LOGIN_URL = "https://www.carrefour.fr/mon-compte/connexion";
const ACCOUNT_URL = "https://www.carrefour.fr/mon-compte";

export async function login(email: string, password: string): Promise<{ success: boolean; message: string }> {
  try {
    const page = await navigateAndWait(LOGIN_URL);

    // Check if already logged in
    if (await isLoggedIn()) {
      await saveCookies();
      return { success: true, message: "Déjà connecté" };
    }

    // Fill login form — Carrefour uses standard email/password fields
    await page.waitForSelector('input[type="email"], input[name="email"], #email, input[autocomplete="email"]', { timeout: 10000 });

    const emailInput = page.locator('input[type="email"], input[name="email"], #email, input[autocomplete="email"]').first();
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first();
    await passwordInput.fill(password);

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for navigation away from login page
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
    // If we stay on the account page (not redirected to login), we're logged in
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
