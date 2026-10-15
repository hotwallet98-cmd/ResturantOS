# RestaurantOS mobile app (store + staff)

One React Native + Expo app (SDK 57, expo-router) with role-based screens:

- **Anyone who opens the app** gets the **store** of one restaurant (`EXPO_PUBLIC_RESTAURANT_SLUG`, default `spice-route` = Spice Route Kitchen). No login: menu → cart → checkout → live tracking → my orders.
- **Staff login** (the dark **Staff** button in the store header) signs a staff member in. The app then opens their role's screens by default:
  - **Waiter**: tables, seating, take order, ready alerts, picked up / served, ask for bill, mark clean.
  - **Rider**: deliveries, online switch, QR pickup scan, call / navigate, collect payment, today's totals.
  - **Other roles** (super admin, restaurant admin, counter, kitchen): a "please use the web app" screen.
- Signed-in staff can still open the store (storefront icon in the staff header; **My shift** in the store header goes back).
- **Log out** returns to the store. The session is kept in SecureStore, so a signed-in staff member reopens straight into their role screens.

It uses the shared packages in `../packages`: `@restaurantos/contracts` (types, paths, rules) and `@restaurantos/api-client` (typed REST + Socket.IO client). Both are `file:` dependencies; Metro bundles them straight from their `src/` (see [Shared packages](#shared-packages)).

## Run

```bash
cd MobileApps
npm install
cp .env.example .env        # then edit EXPO_PUBLIC_API_URL if needed
npx expo start              # a = Android emulator, i = iOS simulator, or scan the QR with Expo Go
```

From the repo root you can also use `npm run install:mobile` and `npm run dev:mobile`.

The backend must be running (`http://localhost:5000/api`, Socket.IO on `http://localhost:5000`).

### Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:5000/api` | REST base URL |
| `EXPO_PUBLIC_RESTAURANT_SLUG` | `spice-route` | Restaurant whose store the app opens on (`/public/restaurants/:slug`) |
| `EXPO_PUBLIC_SOCKET_URL` | API URL without `/api` | Optional Socket.IO origin (path `/socket.io`), used by order tracking and the staff feed |

### Pointing the app at the backend

| Where the app runs   | `EXPO_PUBLIC_API_URL` |
| -------------------- | --------------------- |
| iOS simulator / web  | `http://localhost:5000/api` (default) |
| Android emulator     | `http://10.0.2.2:5000/api` (`localhost` inside the emulator is the emulator itself) |
| Real phone (Expo Go) | `http://<PC LAN IP>:5000/api`, e.g. `http://192.168.1.20:5000/api` |

On a real phone:

- Use the PC's LAN IP from `ipconfig` (Windows).
- The phone and the PC must be on the same Wi-Fi.
- Windows Firewall must allow inbound connections on port 5000.

`EXPO_PUBLIC_*` values are inlined at bundle time, so restart with `npx expo start -c` after changing `.env`. The staff login screen shows the server it is using.

Expo Go includes every native module used here (`expo-camera`, `expo-secure-store`, AsyncStorage), so you don't need a dev build. Plain `http://` works in Expo Go and debug builds; a release build needs HTTPS or a cleartext exception (for example via `expo-build-properties`).

### Demo staff logins

- Waiter: `hamza.floor@spiceroute.com`
- Rider: `usman.rider@spiceroute.com`

Any password works. Tap a demo account on the login screen, then **Fill demo code** (`123456`) for MFA.

## Routes (`src/app`)

Route groups only organise files; the root `_layout.tsx` is one flat Stack.

| Route | Screen |
| --- | --- |
| `/` (`index.tsx`) | Entry: no session → `/menu`; staff session → `/waiter`, `/rider` or `/unsupported` by role |
| **Store** `(store)/` | |
| `/menu` | Store header (name, ETA, fee; closed / not-found states), **Staff** / **My shift** button. Menu: categories, search, variants, qty steppers, cart bar, active-order banner |
| `/cart` | Cart & checkout (name, phone, address, kitchen note, Cash / Easypaisa) → `POST /public/restaurants/:slug/orders` |
| `/track/[id]` | Live tracking (Socket.IO `connectOrderFeed`, polling fallback every 15 s), verification-call card, rider card |
| `/orders` | My orders (stored on the phone with AsyncStorage) |
| **Staff** `(staff)/` | |
| `/login` | Email + password → MFA code; demo accounts; "Back to the store" |
| `/unsupported` | "Use the web app" for roles other than waiter / rider (log out or open the store) |
| `/waiter` (tabs: Tables, My orders, Ready) | Tables + table sheet, my open orders, ready alerts (vibrate + toast) |
| `/take-order/[tableId]` | Menu, variants, qty, kitchen note → `POST /orders/table` |
| `/rider` (tabs: Deliveries, Today) | Online switch, assigned deliveries, call / navigate; delivered today, cash in hand |
| `/scan/[orderId]` | QR pickup scanner (manual fallback) → `POST /orders/:id/pickup` |
| `/collect/[orderId]` | Cash or Easypaisa → `POST /orders/:id/deliver` |

Navigation after sign-in / sign-out clears the history (`resetTo` in `src/lib/nav.ts`), so Back never jumps between the store and the staff screens.

## Code layout

- `src/lib/api.ts`: the app's **single** `createApiClient` instance (15 s fetch timeout). Store calls (`api.store.*`) are public and never send a token; staff calls send the JWT mirrored from SecureStore. A 401 while signed in logs the user out.
- `src/lib/config.ts`: API / socket URL, restaurant slug, demo accounts.
- `src/state/`: `auth.tsx` (staff session, SecureStore), `flow.tsx` (live staff data: `GET /flow` + `connectStaffFeed`; idle while signed out), `toast.tsx`.
- `src/components/`: staff UI (`ui.tsx`, `chrome.tsx`, `waiter.tsx`) and `staff-entry.tsx` (the store header's Staff button).
- `src/store/`: the store's own code: `components/ui.tsx`, `lib/` (theme, format, status, AsyncStorage, `useTrackedOrder`), `state/` (`restaurant.tsx`, `cart.tsx`).
- The root layout provides: SafeArea → Theme → Auth → Flow → Toast → Restaurant → Cart.

## Shared packages

The app is not an npm workspace member (Expo pins its own React), so `npm install` here links `../packages/contracts` and `../packages/api-client` into `node_modules/@restaurantos/*`. `metro.config.js`:

- watches `../packages` and bundles the packages' TypeScript source (their `react-native` field → `src/index.ts`);
- resolves every dependency from this app's `node_modules`, and redirects bare imports made from inside `packages/*` to this app, so the monorepo root `node_modules` (web apps' React / socket.io-client) is never used;
- block-lists every `packages/*/node_modules`.

`tsconfig.json` maps both packages to the same sources, so no package build is needed.

## Checks

```bash
npm run typecheck                    # tsc --noEmit
npx expo-doctor
npx expo export --platform android   # bundling check (delete the output folder afterwards)
npx tsx scripts/smoke.ts             # API smoke test with the app's client; needs the backend running
```

`scripts/smoke.ts` covers the store (restaurant + menu, places a Cash order, tracks it over REST and the order socket) and staff (waiter and rider login with the MFA demo code, `/flow`, staff socket). It changes backend state: it places a real order and sets the demo rider to Available.
