/**
 * The app's single RestaurantOS API client (`@restaurantos/api-client`), shared by the store and the
 * staff screens. Store calls (`api.store.*`) are public and never send the token; staff calls send the
 * staff JWT. The token lives in SecureStore (see state/auth.tsx), which mirrors it here so requests
 * don't hit the keychain each time. A 401 while signed in logs the user out.
 */
import { ApiError, createApiClient, type ApiClient } from '@restaurantos/api-client'
import { API_URL } from './config'

export { ApiError }

let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export const setAuthToken = (token: string | null) => {
  authToken = token
}
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

const TIMEOUT_MS = 15_000

/** fetch with a timeout (the shared client has none). */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const createAppApi = (baseUrl: string): ApiClient =>
  createApiClient({
    baseUrl,
    getToken: () => authToken,
    // Only a 401 on an authenticated session means "token dead" (a bad login code also 401s).
    onUnauthorized: () => {
      if (authToken) onUnauthorized?.()
    },
    fetch: fetchWithTimeout,
  })

export const api = createAppApi(API_URL)

export const errorMessage = (e: unknown) => {
  if (e instanceof ApiError && !e.message) return `Request failed (${e.status})`
  return e instanceof Error ? e.message : 'Something went wrong'
}
