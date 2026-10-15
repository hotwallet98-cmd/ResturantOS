/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RequireAuth } from '@/shared/components/RequireAuth'

const RiderApp = lazy(() => import('./pages/RiderApp'))

/** Rider app — delivery riders and restaurant admins. */
export const riderRoutes = (
  <Route
    path="/rider"
    element={
      <RequireAuth roles={['rider', 'restaurant_admin']}>
        <RiderApp />
      </RequireAuth>
    }
  />
)
