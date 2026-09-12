import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'dairy-sales-token';
let inMemoryWebToken: string | null = null;

function getWebStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getStoredToken() {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(TOKEN_KEY) ?? inMemoryWebToken;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  if (Platform.OS === 'web') {
    inMemoryWebToken = token;
    getWebStorage()?.setItem(TOKEN_KEY, token);
    return;
  }

  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  if (Platform.OS === 'web') {
    inMemoryWebToken = null;
    getWebStorage()?.removeItem(TOKEN_KEY);
    return;
  }

  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
