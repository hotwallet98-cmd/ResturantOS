/* Route config module: exports route elements, not components. */
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { AppShell } from '@/shared/components/layout/AppShell'
import { RequireAuth } from '@/shared/components/RequireAuth'
import { adminNav } from './nav'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Tenants = lazy(() => import('./pages/Tenants'))
const TenantOnboarding = lazy(() => import('./pages/TenantOnboarding'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const PlatformUsers = lazy(() => import('./pages/PlatformUsers'))
const Authentication = lazy(() => import('./pages/Authentication'))
const PlatformConfig = lazy(() => import('./pages/PlatformConfig'))
const Support = lazy(() => import('./pages/Support'))

/** Super Admin Portal — platform owner. */
export const adminRoutes = (
  <Route
    path="/admin"
    element={
      <RequireAuth roles={['super_admin']}>
        <AppShell portal="admin" nav={adminNav} />
      </RequireAuth>
    }
  >
    <Route index element={<Dashboard />} />
    <Route path="tenants" element={<Tenants />} />
    <Route path="onboarding" element={<TenantOnboarding />} />
    <Route path="subscriptions" element={<Subscriptions />} />
    <Route path="users" element={<PlatformUsers />} />
    <Route path="security" element={<Authentication />} />
    <Route path="config" element={<PlatformConfig />} />
    <Route path="support" element={<Support />} />
  </Route>
)
