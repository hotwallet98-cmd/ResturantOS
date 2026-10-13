import { Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { adminRoutes } from '@/apps/admin/routes'
import { authRoutes } from '@/apps/auth/routes'
import { counterRoutes } from '@/apps/counter/routes'
import { customerRoutes } from '@/apps/customer/routes'
import { kitchenRoutes } from '@/apps/kitchen/routes'
import { restaurantRoutes } from '@/apps/restaurant/routes'
import { riderRoutes } from '@/apps/rider/routes'
import { waiterRoutes } from '@/apps/waiter/routes'
import { RootRedirect } from '@/shared/components/RequireAuth'
import { LoadingState, ToastProvider } from '@/shared/components/ui'
import { AuthProvider } from '@/shared/context/AuthContext'
import DeploymentGuide from '@/pages/DeploymentGuide'

/**
 * Each app lives in src/apps/<app> with its own pages, nav and routes;
 * code used by more than one app lives in src/shared.
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/Deployment" element={<DeploymentGuide />} />
              <Route path="/" element={<RootRedirect />} />
              {authRoutes}
              {customerRoutes}
              {adminRoutes}
              {restaurantRoutes}
              {kitchenRoutes}
              {counterRoutes}
              {waiterRoutes}
              {riderRoutes}
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
