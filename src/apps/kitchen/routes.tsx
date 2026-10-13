/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { Gate } from '@/shared/components/plan/Gate'
import { RequireAuth } from '@/shared/components/RequireAuth'
import { VoiceStatusPill } from './components/VoiceAgent'
import { KitchenProvider } from './context/KitchenContext'
import { kitchenNav } from './nav'

const LiveOrders = lazy(() => import('./pages/LiveOrders'))
const StockAlerts = lazy(() => import('./pages/StockAlerts'))
const StockEntry = lazy(() => import('./pages/StockEntry'))
const VoiceSettings = lazy(() => import('./pages/VoiceSettings'))

/** Kitchen Portal — kitchen staff and restaurant admins. */
export const kitchenRoutes = (
  <Route
    path="/kitchen"
    element={
      <RequireAuth roles={['kitchen_staff', 'restaurant_admin']}>
        <KitchenProvider>
          <AppShell portal="kitchen" nav={kitchenNav} headerExtra={<VoiceStatusPill />} />
        </KitchenProvider>
      </RequireAuth>
    }
  >
    <Route index element={<Gate feature="kitchen"><LiveOrders /></Gate>} />
    <Route path="alerts" element={<Gate feature="stockAlerts"><StockAlerts /></Gate>} />
    <Route path="stock" element={<Gate feature="smartStock"><StockEntry /></Gate>} />
    <Route path="voice" element={<Gate feature="kitchenVoice"><VoiceSettings /></Gate>} />
  </Route>
)
