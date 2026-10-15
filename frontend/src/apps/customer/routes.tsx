/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'

const CustomerApp = lazy(() => import('./pages/CustomerApp'))

/** Public customer ordering app — no staff login. */
export const customerRoutes = <Route path="/order" element={<CustomerApp />} />
