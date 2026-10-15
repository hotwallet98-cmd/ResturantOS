# RestaurantOS — Frontend Prototype

React prototype of the RestaurantOS platform, built from the product mind map. It runs entirely on mock data so it can be demoed before the backend exists.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router 7 · Recharts · lucide-react

## Run it

```bash
cd Frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

Sign in with any password. Pick **Super Admin** or **Restaurant** on the login screen. Use **Fill demo code** on the MFA step. Once signed in, the user menu (top right) switches between the two portals.

## What's in it (mind map → routes)

| Mind map area | Route | File |
|---|---|---|
| Secure Login & MFA, Password Recovery | `/login` | `pages/auth/Login.tsx` |
| **Super Admin Portal** | | |
| Super Admin Dashboard | `/admin` | `pages/admin/Dashboard.tsx` |
| Restaurant / Tenant Management | `/admin/tenants` | `pages/admin/Tenants.tsx` |
| Restaurant Onboarding Flow (registration → activation) | `/admin/onboarding` | `pages/admin/TenantOnboarding.tsx` |
| Subscription & Billing Management | `/admin/subscriptions` | `pages/admin/Subscriptions.tsx` |
| Platform User & Access Management | `/admin/users` | `pages/admin/PlatformUsers.tsx` |
| Super Admin Authentication | `/admin/security` | `pages/admin/Authentication.tsx` |
| Platform Configuration & Integrations | `/admin/config` | `pages/admin/PlatformConfig.tsx` |
| Platform Support & Monitoring | `/admin/support` | `pages/admin/Support.tsx` |
| **Restaurant Admin Setup** (activation → go-live) | `/setup` | `pages/onboarding/RestaurantAdminSetup.tsx` |
| **Restaurant's Operations** | | |
| Operations dashboard | `/app` | `pages/restaurant/Dashboard.tsx` |
| Central AI & Automation Engine | `/app/ai` | `pages/restaurant/AIEngine.tsx` |
| Order & POS Management | `/app/pos` | `pages/restaurant/Pos.tsx` |
| Table & Reservation Management | `/app/tables` | `pages/restaurant/Tables.tsx` |
| Delivery & Takeaway Management | `/app/delivery` | `pages/restaurant/Delivery.tsx` |
| Customer & Loyalty Management | `/app/customers` | `pages/restaurant/Customers.tsx` |
| Kitchen Operations (KDS) | `/app/kitchen` | `pages/restaurant/Kitchen.tsx` |
| Menu & Recipe Management | `/app/menu` | `pages/restaurant/Menu.tsx` |
| Inventory Management | `/app/inventory` | `pages/restaurant/Inventory.tsx` |
| Suppliers & Procurement | `/app/suppliers` | `pages/restaurant/Suppliers.tsx` |
| Online Menu Management | `/app/online-menu` | `pages/restaurant/OnlineMenu.tsx` |
| Social Media & Marketing | `/app/social` | `pages/restaurant/SocialMedia.tsx` |
| Employee & HR Management | `/app/employees` | `pages/restaurant/Employees.tsx` |
| Finance & Accounting | `/app/finance` | `pages/restaurant/Finance.tsx` |
| Quality, Safety & Compliance | `/app/compliance` | `pages/restaurant/Compliance.tsx` |
| Reports & Business Intelligence | `/app/reports` | `pages/restaurant/Reports.tsx` |

Each module's **AI** capability from the mind map (forecasting, recommendations, anomaly detection, and so on) appears on that page as an "AI Insights" panel. The **AI Copilot** button in the top bar is available on every screen.

## Project structure

```
src/
  components/
    ui/          Design system: Button, Card, DataTable, Tabs, Modal/Drawer, Form, StatCard, AIInsights, …
    layout/      AppShell (sidebar + top bar), CopilotDrawer
  context/       AuthContext (session user, selected branch)
  hooks/         useAsync (loads data from a service function)
  lib/           format (currency/dates), chart (Recharts theme), cn
  services/      API layer + mock data, one file per domain
    client.ts      request()/mutate(): mock vs. real backend switch
    auth.ts        login, MFA, password reset
    copilot.ts     AI copilot
    admin.ts       Super Admin + onboarding
    operations.ts  POS, kitchen, menu, tables, inventory, delivery, HR
    business.ts    suppliers, customers, online menu, social, finance, compliance, reports, AI engine
  pages/         One file per screen (see table above)
  navigation.ts  Sidebar menus for both portals
```

## Connecting the backend later

Pages never call `fetch` directly. They call service functions, and every service function goes through `request()` / `mutate()` in `src/services/client.ts`:

```ts
export const getTenants = () => request<Tenant[]>('/admin/tenants', tenants /* mock data */)
```

To switch to a real API:

1. Copy `.env.example` to `.env`, then set `VITE_USE_MOCKS=false` and `VITE_API_BASE_URL=https://your-api/api`.
2. Implement the endpoints named in the `src/services/*.ts` files. The TypeScript interfaces in those files are the request/response contracts.
3. Auth: `POST /auth/login` → `{ mfaRequired, challengeId }`, then `POST /auth/mfa/verify` → `{ token, user }`. The token is sent as `Authorization: Bearer <token>`.

No page components need to change.
