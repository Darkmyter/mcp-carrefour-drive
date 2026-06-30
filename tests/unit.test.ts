/**
 * Unit tests — pure logic, no browser needed.
 */
import { describe, it, expect } from "vitest";

// Price parsing helper (handles both French "1,15" and standard "1.15" formats)
function parsePrice(text: string): number {
  // Remove everything except digits, dots, and commas
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  
  // If both comma and dot present, determine which is the decimal separator
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // French format: "1.234,56" — comma is decimal
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Comma is decimal: "1.234,56" → "1234.56"
      return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      // Dot is decimal: "1,234.56" → "1234.56"
      return parseFloat(cleaned.replace(/,/g, "")) || 0;
    }
  }
  
  if (cleaned.includes(",")) {
    // Only comma: French format "1,15" or "1 234,56"
    return parseFloat(cleaned.replace(/,/g, ".")) || 0;
  }
  
  // Only dot or plain digits
  return parseFloat(cleaned) || 0;
}

// Name splitting helper (brand + product name from Carrefour card text)
function splitBrandAndName(fullText: string): { brand: string; name: string } {
  const trimmed = fullText.trim();
  const parts = trimmed.split(/\s{2,}/);
  return {
    brand: parts.length > 1 ? parts[0].trim() : "",
    name: parts.length > 1 ? parts.slice(1).join(" ").trim() : trimmed,
  };
}

// Product ID extraction from href
function extractProductId(href: string): string {
  return href.split("/").pop() || "";
}

describe("parsePrice", () => {
  it("parses standard French price", () => {
    expect(parsePrice("1 ,15 €")).toBe(1.15);
  });

  it("parses price with no spaces", () => {
    expect(parsePrice("2,55€")).toBe(2.55);
  });

  it("parses integer price", () => {
    expect(parsePrice("3 €")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(parsePrice("")).toBe(0);
  });

  it("returns 0 for non-numeric text", () => {
    expect(parsePrice("N/A")).toBe(0);
  });

  it("parses price with unit (dot decimal)", () => {
    expect(parsePrice("1.15 € / L")).toBe(1.15);
  });

  it("parses price with unit (comma decimal)", () => {
    expect(parsePrice("1,15 € / L")).toBe(1.15);
  });

  it("parses large price", () => {
    expect(parsePrice("12 ,90 €")).toBe(12.9);
  });

  it("parses price with thousands separator", () => {
    expect(parsePrice("1.234,56 €")).toBe(1234.56);
  });
});

describe("splitBrandAndName", () => {
  it("splits brand and name on double space", () => {
    const result = splitBrandAndName("CANDIA  Lait Vitaminé Viva CANDIA");
    expect(result.brand).toBe("CANDIA");
    expect(result.name).toBe("Lait Vitaminé Viva CANDIA");
  });

  it("handles single-part name (no brand)", () => {
    const result = splitBrandAndName("Lait Demi-Ecrémé");
    expect(result.brand).toBe("");
    expect(result.name).toBe("Lait Demi-Ecrémé");
  });

  it("handles brand with multiple spaces", () => {
    const result = splitBrandAndName("CARREFOUR EXTRA  Riz Basmati Long");
    expect(result.brand).toBe("CARREFOUR EXTRA");
    expect(result.name).toBe("Riz Basmati Long");
  });

  it("trims whitespace", () => {
    const result = splitBrandAndName("  SIMPL  Lait Demi-Ecrémé  ");
    expect(result.brand).toBe("SIMPL");
    expect(result.name).toBe("Lait Demi-Ecrémé");
  });
});

describe("extractProductId", () => {
  it("extracts EAN from product URL", () => {
    expect(extractProductId("/p/lait-vitamine-viva-candia-3176571983008")).toBe("lait-vitamine-viva-candia-3176571983008");
  });

  it("extracts from full URL", () => {
    expect(extractProductId("https://www.carrefour.fr/p/riz-basmati-long-carrefour-extra-3560070837984")).toBe("riz-basmati-long-carrefour-extra-3560070837984");
  });

  it("returns empty for root path", () => {
    expect(extractProductId("/")).toBe("");
  });
});
