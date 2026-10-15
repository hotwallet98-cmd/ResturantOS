import { createApiClient } from '@restaurantos/api-client'
import { API_BASE_URL, getToken, setToken } from './client'

export const AUTH_INVALIDATED_EVENT = 'restaurantos:auth-invalidated'

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken,
  onUnauthorized: () => {
    setToken(null)
    window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
  },
})
