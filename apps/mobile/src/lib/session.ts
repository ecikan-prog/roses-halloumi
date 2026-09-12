import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'dairy-sales-token';
let inMemoryWebToken: string | null = null;

export async function getStoredToken() {
  if (Platform.OS === 'web') {
    return inMemoryWebToken;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  if (Platform.OS === 'web') {
    inMemoryWebToken = token;
    return;
  }

  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  if (Platform.OS === 'web') {
    inMemoryWebToken = null;
    return;
  }

  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
