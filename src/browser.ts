import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.CARREFOUR_DATA_DIR || path.join(process.env.HOME || "/tmp", ".carrefour-mcp");
const COOKIES_PATH = path.join(DATA_DIR, "cookies.json");

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: false, // DataDome/Cloudflare blocks headless
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  return browser;
}

export async function getContext(): Promise<BrowserContext> {
  if (!context) {
    const b = await getBrowser();
    ensureDataDir();

    const contextOptions = {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
    };

    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf-8"));
      context = await b.newContext(contextOptions);
      await context.addCookies(cookies);
    } else {
      context = await b.newContext(contextOptions);
    }

    // Patch navigator.webdriver to avoid bot detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
  }
  return context;
}

export async function getPage(): Promise<Page> {
  if (!page || page.isClosed()) {
    const ctx = await getContext();
    page = await ctx.newPage();
  }
  return page;
}

export async function saveCookies(): Promise<void> {
  if (context) {
    ensureDataDir();
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  }
}

export async function closeBrowser(): Promise<void> {
  await saveCookies();
  if (page && !page.isClosed()) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
  page = null;
  context = null;
  browser = null;
}

export async function navigateAndWait(url: string, options?: { timeout?: number }): Promise<Page> {
  const p = await getPage();
  const timeout = options?.timeout ?? 45000;
  await p.goto(url, { waitUntil: "domcontentloaded", timeout });

  // Wait for any Cloudflare/anti-bot challenge to resolve
  const title = await p.title();
  if (title.includes("moment") || title.includes("challenge")) {
    // Cloudflare challenge page — wait for it to resolve
    await p.waitForFunction(
      () => !document.title.includes("moment") && !document.title.includes("challenge"),
      { timeout: 30000 }
    ).catch(() => {});
  }

  // Dismiss cookie banner if present (OneTrust)
  try {
    const cookieBtn = p.locator("#onetrust-accept-btn-handler");
    if (await cookieBtn.isVisible({ timeout: 2000 })) {
      await cookieBtn.click();
      await p.waitForTimeout(500);
    }
  } catch {
    // No cookie banner
  }
  return p;
}
