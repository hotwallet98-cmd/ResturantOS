/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { Gate } from '@/shared/components/plan/Gate'
import { RequireAuth } from '@/shared/components/RequireAuth'
import { restaurantNav } from './nav'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Plans = lazy(() => import('./pages/Plans'))
const AIEngine = lazy(() => import('./pages/AIEngine'))
const Pos = lazy(() => import('./pages/Pos'))
const Tables = lazy(() => import('./pages/Tables'))
const Delivery = lazy(() => import('./pages/Delivery'))
const Customers = lazy(() => import('./pages/Customers'))
const MenuPage = lazy(() => import('./pages/Menu'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const OnlineMenu = lazy(() => import('./pages/OnlineMenu'))
const SocialMedia = lazy(() => import('./pages/SocialMedia'))
const Employees = lazy(() => import('./pages/Employees'))
const Finance = lazy(() => import('./pages/Finance'))
const Compliance = lazy(() => import('./pages/Compliance'))
const Reports = lazy(() => import('./pages/Reports'))
const RestaurantAdminSetup = lazy(() => import('./pages/onboarding/RestaurantAdminSetup'))

/** Restaurant Admin — each page is gated by the restaurant's subscription tier. */
export const restaurantRoutes = (
  <>
    <Route
      path="/setup"
      element={
        <RequireAuth roles={['restaurant_admin']}>
          <RestaurantAdminSetup />
        </RequireAuth>
      }
    />
    <Route
      path="/app"
      element={
        <RequireAuth roles={['restaurant_admin']}>
          <AppShell portal="restaurant" nav={restaurantNav} />
        </RequireAuth>
      }
    >
      <Route index element={<Gate feature="dashboard"><Dashboard /></Gate>} />
      <Route path="plans" element={<Plans />} />
      <Route path="ai" element={<Gate feature="ai"><AIEngine /></Gate>} />
      <Route path="pos" element={<Gate feature="pos"><Pos /></Gate>} />
      <Route path="tables" element={<Gate feature="tables"><Tables /></Gate>} />
      <Route path="delivery" element={<Gate feature="delivery"><Delivery /></Gate>} />
      <Route path="customers" element={<Gate feature="customers"><Customers /></Gate>} />
      <Route path="kitchen" element={<Navigate to="/kitchen" replace />} />
      <Route path="menu" element={<Gate feature="menu"><MenuPage /></Gate>} />
      <Route path="inventory" element={<Gate feature="inventory"><Inventory /></Gate>} />
      <Route path="suppliers" element={<Gate feature="suppliers"><Suppliers /></Gate>} />
      <Route path="online-menu" element={<Gate feature="onlineMenu"><OnlineMenu /></Gate>} />
      <Route path="social" element={<Gate feature="social"><SocialMedia /></Gate>} />
      <Route path="employees" element={<Gate feature="employees"><Employees /></Gate>} />
      <Route path="finance" element={<Gate feature="finance"><Finance /></Gate>} />
      <Route path="compliance" element={<Gate feature="compliance"><Compliance /></Gate>} />
      <Route path="reports" element={<Gate feature="reports"><Reports /></Gate>} />
    </Route>
  </>
)
