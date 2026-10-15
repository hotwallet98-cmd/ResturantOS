/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { Gate } from '@/shared/components/plan/Gate'
import { RequireAuth } from '@/shared/components/RequireAuth'
import { counterNav } from './nav'

const Counter = lazy(() => import('./pages/Counter'))

/** Main counter / cashier — counter staff and restaurant admins. */
export const counterRoutes = (
  <Route
    path="/counter"
    element={
      <RequireAuth roles={['counter_staff', 'restaurant_admin']}>
        <AppShell portal="counter" nav={counterNav} />
      </RequireAuth>
    }
  >
    <Route index element={<Gate feature="counter"><Counter view="live" /></Gate>} />
    <Route path="billing" element={<Gate feature="pos"><Counter view="billing" /></Gate>} />
    <Route path="deliveries" element={<Gate feature="delivery"><Counter view="deliveries" /></Gate>} />
  </Route>
)
