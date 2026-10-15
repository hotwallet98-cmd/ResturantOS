/**
 * API client.
 *
 * Every service function goes through `request()`. While VITE_USE_MOCKS is true
 * (the default) it resolves with the provided mock data after a short delay;
 * set VITE_USE_MOCKS=false and VITE_API_BASE_URL to hit the real backend
 * without touching any page component.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
export const USE_MOCKS: boolean = (import.meta.env.VITE_USE_MOCKS ?? 'true') === 'true'
export const FALLBACK_TO_MOCKS: boolean = (import.meta.env.VITE_FALLBACK_TO_MOCKS ?? 'true') === 'true'

const TOKEN_KEY = 'ros.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export function mock<T>(data: T, delay = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), delay))
}

/** GET-style call: returns mock data in mock mode, otherwise calls the backend. */
export function request<T>(path: string, mockData: T, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) return mock(mockData)

  return http<T>(path, init).catch((error: unknown) => {
    // The MVP API intentionally exposes only auth, menu and live operations.
    // Keep unfinished read-only modules usable during the migration, but never
    // mask authorization failures or failed writes.
    if (FALLBACK_TO_MOCKS && error instanceof ApiError && error.status === 404 && (!init?.method || init.method === 'GET')) {
      return mock(mockData, 0)
    }
    throw error
  })
}

/** Mutation helper (POST/PUT/PATCH/DELETE). In mock mode echoes the body back. */
export function mutate<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: T): Promise<T> {
  return USE_MOCKS
    ? mock(body as T, 300)
    : http<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}
