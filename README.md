# RestaurantOS

A restaurant operating system: **one web app**, **one mobile app** and **one API**, all with role-based access.

```
ResturantOS/
â”œâ”€â”€ Frontend/        Web app (React + Vite) on :5173, with role-based login
â”‚                      /platform     Super Admin (platform owner)
â”‚                      /app          Restaurant Admin (Manage)
â”‚                      /counter      Counter / cashier
â”‚                      /kitchen      Kitchen (KDS + Urdu voice agent)
â”‚                      /floor        Waiter (tablet)
â”‚                      /store/:slug  Customer online store (public, no login)
â”œâ”€â”€ MobileApps/      Mobile app (React Native + Expo)
â”‚                      opens as the customer store; "Staff login" turns it into
â”‚                      the Waiter or Rider app depending on the role
â”œâ”€â”€ Backend/         API (NestJS modular monolith + Prisma + Socket.IO) on :5000/api
â””â”€â”€ packages/        shared code
    â”œâ”€â”€ contracts/     API contract, domain types, order rules, subscription plans
    â”œâ”€â”€ api-client/    typed REST + Socket.IO client (web + mobile)
    â””â”€â”€ ui-web/        React + Tailwind UI kit and theme (web)
```

## How access works

- **One login for every staff role.** The backend checks the role and the restaurant's plan on every request (`TRANSITION_ROLES`, plan features). The web app sends each role to its own workspace. The restaurant admin can switch between Manage, Counter, Kitchen and Floor.
- **Customers never log in.** The store is public per restaurant slug, and an order is tracked with a tracking token.
- **Riders** use the mobile app, which needs the camera for the QR bag scan and maps for navigation.
- Each role's pages are lazy-loaded, so a browser only downloads code for screens it actually opens.

## MVP scope (Free tier)

1. **Dine-in**: The waiter seats a table (reservation or walk-in) and takes the order. The counter logs it and forwards it to the kitchen. The kitchen marks it ready, which alerts the waiter and the counter. The waiter serves, the counter takes the bill and tip, and the table is freed.
2. **Delivery**: The customer orders from the store, on web or mobile. The voice agent calls them to confirm. The kitchen gets a voice alert and staff confirm. A rider is notified. When it's ready, the counter packs it with a QR bag label. The rider scans the label, delivers, and collects Cash or Easypaisa.

Pro and Enterprise unlock everything else. Plans are defined in `packages/contracts/src/plans.ts`.

## Local installation paths

The current checkout uses `frontend/`, `Backend/Backend/`, `packages/packages/*`, and `Mobile Apps/`. Root npm scripts resolve these locations; run them from this directory.

```powershell
npm install
npm run install:mobile
npm run build:contracts
npm run dev:web
# In separate terminals:
npm run dev:api
npm run dev:mobile
```

## Run it

```bash
npm install                 # web, API, packages (npm workspaces)
npm run build:contracts
npm run install:mobile      # the Expo app installs separately (it pins its own React)

npm run db:seed             # demo restaurant "spice-route"
npm run dev:api             # http://localhost:5000/api   (health: /api/health)
npm run dev:web             # http://localhost:5173
npm run dev:mobile          # Expo, then scan the QR with Expo Go
npm run db:studio           # browse the database at http://localhost:5555
```

- **Database**: PostgreSQL for local development and production. Configure `Backend/Backend/.env`, then apply migrations and seed the demo data.
- **Web and the API**: `VITE_USE_MOCKS=false` runs the MVP flow live against the API. `VITE_MOCK_MODULES=true` keeps modules that don't have backend endpoints yet (inventory, HR, finance, AIâ€¦) on demo data.
- **Mobile**: set `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:5000/api` on a phone, or `http://10.0.2.2:5000/api` on the Android emulator.
- After changing `packages/contracts`, run `npm run build:contracts`. The API uses its compiled output.
