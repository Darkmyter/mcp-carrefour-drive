#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { login, isLoggedIn, logout } from "./auth.js";
import { selectStoreByPostalCode } from "./store.js";
import { searchProducts, getProductDetails } from "./search.js";
import { addToCart, removeFromCart, getCart, updateCartItemQuantity } from "./cart.js";
import { getAvailableSlots, selectSlot } from "./slots.js";
import { getCheckoutSummary, confirmAndPay } from "./checkout.js";
import { closeBrowser } from "./browser.js";

const server = new McpServer({
  name: "carrefour-drive",
  version: "0.1.0",
});

// --- Auth ---

server.tool(
  "login",
  {
    email: z.string().email().describe("Email du compte Carrefour"),
    password: z.string().describe("Mot de passe du compte Carrefour"),
  },
  async ({ email, password }) => {
    const result = await login(email, password);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
);

server.tool("check_login", {}, async () => {
  const loggedIn = await isLoggedIn();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ loggedIn, message: loggedIn ? "Connecté" : "Non connecté" }),
      },
    ],
  };
});

server.tool("logout", {}, async () => {
  const result = await logout();
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
});

// --- Store ---

server.tool(
  "select_store",
  {
    postalCode: z.string().describe("Code postal pour rechercher les magasins"),
    storeName: z.string().optional().describe("Nom du magasin à sélectionner (optionnel, ex: 'Ménétrol')"),
  },
  async ({ postalCode, storeName }) => {
    const result = await selectStoreByPostalCode(postalCode, storeName);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  }
);

// --- Search ---

server.tool(
  "search_products",
  {
    query: z.string().describe("Terme de recherche (ex: 'lait demi-écrémé', 'poulet', 'pâtes')"),
    limit: z.number().int().positive().optional().default(10).describe("Nombre max de résultats (défaut: 10)"),
  },
  async ({ query, limit }) => {
    const products = await searchProducts(query, limit);
    if (products.length === 0) {
      return {
        content: [{ type: "text", text: `Aucun produit trouvé pour "${query}"` }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
    };
  }
);

server.tool(
  "get_product_details",
  {
    productUrl: z.string().describe("URL ou ID du produit (ex: '/p/lait-demi-ecreme-carrefour-3245678' ou l'URL complète)"),
  },
  async ({ productUrl }) => {
    const details = await getProductDetails(productUrl);
    if (!details) {
      return {
        content: [{ type: "text", text: "Impossible de récupérer les détails du produit" }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
    };
  }
);

// --- Cart ---

server.tool(
  "add_to_cart",
  {
    productId: z.string().describe("ID ou URL du produit à ajouter"),
    quantity: z.number().int().positive().optional().default(1).describe("Quantité (défaut: 1)"),
  },
  async ({ productId, quantity }) => {
    const result = await addToCart(productId, quantity);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
);

server.tool(
  "remove_from_cart",
  {
    productId: z.string().describe("ID du produit à retirer du panier"),
  },
  async ({ productId }) => {
    const result = await removeFromCart(productId);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
);

server.tool(
  "update_cart_quantity",
  {
    productId: z.string().describe("ID du produit"),
    quantity: z.number().int().positive().describe("Nouvelle quantité"),
  },
  async ({ productId, quantity }) => {
    const result = await updateCartItemQuantity(productId, quantity);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
);

server.tool("get_cart", {}, async () => {
  const cart = await getCart();
  return {
    content: [{ type: "text", text: JSON.stringify(cart, null, 2) }],
  };
});

// --- Slots ---

server.tool("get_available_slots", {}, async () => {
  const slots = await getAvailableSlots();
  if (slots.length === 0) {
    return {
      content: [{ type: "text", text: "Aucun créneau disponible" }],
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify(slots, null, 2) }],
  };
});

server.tool(
  "select_slot",
  {
    slotId: z.string().describe("ID du créneau à réserver (ex: 'slot-0')"),
  },
  async ({ slotId }) => {
    const result = await selectSlot(slotId);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
);

// --- Checkout ---

server.tool("get_checkout_summary", {}, async () => {
  const result = await getCheckoutSummary();
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
});

server.tool("confirm_and_pay", {}, async () => {
  const result = await confirmAndPay();
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
});

// --- Lifecycle ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
