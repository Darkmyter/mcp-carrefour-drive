export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  pricePerUnit: string;
  image: string;
  available: boolean;
  promotion?: string;
  quantity?: string;
}

export interface ProductDetails extends Product {
  description: string;
  ingredients?: string;
  nutritionFacts?: Record<string, string>;
  allergens?: string[];
  origin?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

export interface DeliverySlot {
  id: string;
  date: string;
  timeRange: string;
  available: boolean;
  price?: number;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  type: string;
}
