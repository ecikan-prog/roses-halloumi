import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'dairy-sales-token';

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
