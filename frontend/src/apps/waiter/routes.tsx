/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RequireAuth } from '@/shared/components/RequireAuth'

const WaiterApp = lazy(() => import('./pages/WaiterApp'))

/** Waiter (floor) app — waiters and restaurant admins. */
export const waiterRoutes = (
  <Route
    path="/waiter"
    element={
      <RequireAuth roles={['waiter', 'restaurant_admin']}>
        <WaiterApp />
      </RequireAuth>
    }
  />
)
