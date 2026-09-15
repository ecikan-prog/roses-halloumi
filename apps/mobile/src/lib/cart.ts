import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CART_KEY = 'dairy-sales-cart';
let inMemoryWebCart: string | null = null;

function getWebStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export async function getStoredCart(): Promise<Record<number, number> | null> {
  let raw: string | null = null;

  if (Platform.OS === 'web') {
    raw = getWebStorage()?.getItem(CART_KEY) ?? inMemoryWebCart;
  } else {
    raw = await SecureStore.getItemAsync(CART_KEY);
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function setStoredCart(quantities: Record<number, number>) {
  const serialized = JSON.stringify(quantities);

  if (Platform.OS === 'web') {
    const webStorage = getWebStorage();

    if (!webStorage) {
      inMemoryWebCart = serialized;
      return;
    }

    webStorage.setItem(CART_KEY, serialized);
    inMemoryWebCart = serialized;
    return;
  }

  return SecureStore.setItemAsync(CART_KEY, serialized);
}

export async function clearStoredCart() {
  if (Platform.OS === 'web') {
    const webStorage = getWebStorage();

    if (!webStorage) {
      inMemoryWebCart = null;
      return;
    }

    webStorage.removeItem(CART_KEY);
    inMemoryWebCart = null;
    return;
  }

  return SecureStore.deleteItemAsync(CART_KEY);
}
