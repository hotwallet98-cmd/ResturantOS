# RestaurantOS — API (`@restaurantos/api`)

NestJS 12 API + Socket.IO for the two Free-tier workflows (dine-in and delivery), built as a modular monolith.
It implements contract v2 in `packages/contracts` (`@restaurantos/contracts`: `api.ts`, `domain.ts`, `plans.ts`) and ports the
browser prototype logic from `Frontend/src/shared/services/flow.ts` and `verifyCall.ts`.

- REST: `http://localhost:5000/api`
- Socket.IO: same server, default path `/socket.io`
- DB: Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)

## Setup (npm workspaces)

Needs Node 24, npm 11, and PostgreSQL. This package is a workspace of the repo-root
`package.json`; dependencies are hoisted to the root `node_modules` and there is no lockfile here.
**Run everything from the repo root** — never a plain `npm install` inside `Backend/Backend`.

```bash
npm install                                        # repo root: installs every workspace
cp Backend/Backend/.env.example Backend/Backend/.env # set the PostgreSQL password
npm run build:contracts                            # packages/contracts → dist/ (CJS)
npm run db:deploy -w @restaurantos/api             # apply PostgreSQL migrations
npm run db:seed   -w @restaurantos/api             # demo restaurant "Spice Route Kitchen" (slug spice-route, plan Free)
npm run dev:api                                    # = npm run start:dev -w @restaurantos/api
```

Add a dependency: `npm install <pkg>@<exact-version> -w @restaurantos/api` (from the root).
The root `package.json` holds the npm workspaces and approved install scripts.

### Demo logins

Any password, then any 6-digit code.

| Role | Email |
|---|---|
| restaurant_admin | omar@spiceroute.com |
| kitchen_staff | imran.kitchen@spiceroute.com |
| counter_staff | sadia.counter@spiceroute.com |
| waiter | hamza.floor@spiceroute.com |
| rider (riderId `rd-4`) | usman.rider@spiceroute.com |
| super_admin (no restaurant) | ayesha@restaurantos.io |

Storefront: `GET /api/public/restaurants/spice-route` (+ `/menu`, `POST /orders`).

## Scripts (run from the repo root with `-w @restaurantos/api`)

| Script | What it does |
|---|---|
| `start:dev` | `prestart:dev` rebuilds `packages/contracts` and runs `prisma generate`, then `nest start --watch` (root alias: `npm run dev:api`) |
| `build` | `prebuild` (same as above), then `nest build` → `dist/` |
| `start` | `node dist/src/main.js` (run `build` first) |
| `typecheck` | `tsc --noEmit` over src, prisma, scripts |
| `db:migrate` | `prisma migrate dev` (creates a new migration after schema changes) |
| `db:deploy` | `prisma migrate deploy` (applies the committed migrations; non-interactive) |
| `db:seed` | `tsx prisma/seed.ts`: wipes and re-seeds the demo restaurant (use this to get clean demo data) |
| `db:reset` | `prisma migrate reset --force` (drop + re-migrate; run `db:seed` after). Prisma blocks this for AI agents — reseed instead |
| `smoke` | `tsx scripts/smoke.ts`: end-to-end test of both workflows + storefront against a running API on a freshly seeded DB |

Smoke test: `npm run db:seed -w @restaurantos/api && npm run start -w @restaurantos/api` in one terminal, then
`npm run smoke -w @restaurantos/api` in another. It waits about 12 s for the demo call timeline. `API_URL` targets another
host, `SMOKE_SLUG` another restaurant.

## Environment (`Backend/Backend/.env`)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `5000` | HTTP + Socket.IO |
| `DATABASE_URL` | required | PostgreSQL URL, e.g. `postgresql://postgres:password@localhost:5432/restaurantos?schema=public` |
| `JWT_SECRET` | `dev-only-secret` if unset | Change it outside local dev |
| `JWT_EXPIRES_IN` | `12h` | |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins |
| `SONIOX_API_KEY` | (empty) | Without it, `POST /voice/soniox-config` returns 503 |
| `SONIOX_REGION` | `us` | `us` / `eu` / `jp` / `in` (Soniox data residency host) |
| `TELEPHONY_PROVIDER` | `demo` | `demo` or `twilio` (stub, see below) |
| `DEMO_CALL_TIME_SCALE` | `1` | Speeds up the demo call (`0.1` = 10x faster) |

`DEFAULT_RESTAURANT_ID` is gone: public endpoints are addressed by restaurant slug.

## Module map

Each folder under `src/` is one Nest module with one responsibility. Dependencies point one way (no `forwardRef`):

| Module | Responsibility |
|---|---|
| `shared/prisma` | `PrismaService` (PostgreSQL driver adapter), `createPrismaClient()` |
| `shared/persistence` | `UnitOfWork` (per-restaurant mutation lock + `changes$` feed), `FlowReader` (live snapshot, open table orders, tracking lookup), row → contract mappers |
| `identity` | Demo login → MFA → JWT; global `JwtAuthGuard` + `RolesGuard`; `@Public @Roles @CurrentUser`, `restaurantOf()` |
| `tenancy` | Restaurants, slug lookup, plans / entitlements (`assertFeature`, `@RequireFeature`, global `FeatureGuard`); `GET /plans`, `PATCH /restaurant/plan`, `GET /public/restaurants/:slug` |
| `catalog` | Menu: `GET /menu` (staff, own restaurant), `GET /public/restaurants/:slug/menu`; prices order lines from the menu |
| `floor` | Tables, reservations, seating, bill request, table status (`/tables/:id/seat`, `bill-request`, `status`) |
| `ordering` | Order creation (waiter `POST /orders/table`, storefront `POST /public/restaurants/:slug/orders`), status machine (`OrderLifecycle`), kitchen items, remake, cancel, tracking |
| `payments` | `POST /tables/:id/pay` (tip split, `PayTableResponse`), delivery payment capture (`payment.txnId`) |
| `delivery` | Riders: assign, auto-assign on Preparing / release on Delivered or Cancelled (lifecycle hook), pickup scan, deliver, `PATCH /riders/:id/status` |
| `verification` | Verification call (`/orders/:id/verify/call`, `verify/confirm`); auto-call for new storefront orders and hang-up on manual moves (lifecycle hook) |
| `telephony` | `TelephonyProvider` interface, `DemoTelephonyProvider`, Twilio + Soniox stub, Roman Urdu call script |
| `realtime` | Socket.IO gateway (staff + customer rooms), broadcasts the `UnitOfWork` change feed, `GET /flow` |
| `voice` | `POST /voice/soniox-config` (temporary Soniox API key) |

```
identity ← tenancy ← catalog ← ordering ← payments ← delivery
                     floor  ← ordering ← verification → telephony
shared ← everyone; realtime only subscribes to UnitOfWork.changes$ (domain modules never import it)
```

`OrderLifecycle.register(listener)` is the extension point that keeps ordering independent: delivery and verification
register `afterTransition` / `afterCustomerOrderPlaced` hooks in `onModuleInit`.

Other folders: `prisma/` (schema, migrations, seed), `prisma.config.ts` (Prisma 7 config, loads `.env`),
`generated/prisma/` (generated client, git-ignored), `scripts/smoke.ts`.

### Rules enforced server-side

- **Transitions**: `canTransition` (TRANSITIONS) → 409. **Roles**: `roleCanSet` (TRANSITION_ROLES) → 403. Riders can only move orders assigned to them.
- **Paid / Delivered** are rejected on `PATCH /orders/:id/status` (400): use `POST /tables/:id/pay` and `POST /orders/:id/deliver`, so a payment is always recorded.
- **Plan**: `@RequireFeature` per endpoint, plus a per-target-status feature in the lifecycle
  (e.g. Preparing/Ready → `kitchen`, Delivered → `riderApp`). Returns 403 with an upgrade message.
  The storefront reports `acceptingOrders` = plan includes `customerApp`; ordering then also needs `delivery`.
- **Pricing**: name, emoji, station and unit price come from the menu (variant price added). Client prices are stripped by the whitelist.
- **Notes**: the order-level note (customer or waiter) is stored on `FlowOrder.notes`; line notes stay on the items.
- **Order numbers** increment per restaurant (`Restaurant.nextOrderNo`).
- **Delivery**: when the kitchen accepts (Preparing), the first Available rider (seed order) is assigned and set to On delivery.
  On Delivered or Cancelled the rider goes back to Available if they have no other active order.
- **Pickup**: `scannedOrderNo`, if sent, must equal the order number (409 otherwise).
- **Pay table**: pays every open dine-in order on the table, splits the tip by order total, stores `txnId` on each payment,
  marks them Paid, frees the table and completes the reservation. Returns `{ table, orders }`.

### Realtime

- Staff: `io(url, { auth: { token } })` joins room `restaurant:<id>`. It gets `flow:snapshot` on connect, then
  `order:updated`, `table:updated`, `rider:updated` and `reservation:updated`.
- Customer: `io(url, { auth: { orderId, trackingToken } })` joins room `order:<id>`. It gets only `order:updated` for that order,
  with the current order sent on connect.
- A bad or missing auth disconnects the socket.

## Telephony (verification call)

`TELEPHONY_PROVIDER=demo` (default) uses `DemoTelephonyProvider`, which follows the prototype's timeline:
ringing at 1.5 s, the agent speaks at 4 s, the customer answers at 9 s and the result comes at 11 s
(`no_answer` resolves at 9 s). Each step is saved to `order.call` and broadcast.
`confirm` → Received, `decline` → Cancelled, `no_answer` → stays Verifying for the counter to retry or confirm.
`POST /orders/:id/verify/call { outcome }` picks the demo outcome. New storefront orders call with `confirm`.

`TELEPHONY_PROVIDER=twilio` selects `TwilioSonioxTelephonyProvider`. **This is a stub**: starting a call returns 503 and
the order is left unchanged. The intended design is in the TODO in `src/telephony/twilio-soniox-telephony.provider.ts`
(Twilio outbound call + media stream → Soniox real-time STT/TTS). To add a provider, implement `TelephonyProvider`
(`startCall(req, events)` / `hangup(orderId)`) and register it in `telephony.module.ts`.

## Soniox temporary keys

`POST /api/voice/soniox-config { usage?: 'transcribe_websocket' | 'tts_rt' }` calls
`POST https://api.soniox.com/v1/auth/temporary-api-key` (or the regional host) with
`{ usage_type, expires_in_seconds: 300, client_reference_id }` and returns `{ api_key, region? }`.
It returns 503 when `SONIOX_API_KEY` is not set and 502 when Soniox rejects the request.

## PostgreSQL setup

Create an empty `restaurantos` database, copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```bash
npm run db:deploy -w @restaurantos/api
npm run db:seed -w @restaurantos/api
```

For production, use a managed PostgreSQL connection URL and run `db:deploy` before starting the API.

## Migrations

| Migration | Change |
|---|---|
| `20261015190000_postgresql_init` | PostgreSQL baseline schema |

`payment.txnId` is stored in the existing `Order.paymentTxnId` column and merged into `payment` by the mapper.

## Known limitations / TODO

- Demo auth only: no password check, any 6-digit code, and MFA challenges are kept in memory.
- The mutation lock is per process. Running several API instances would need a DB-level lock or a queue.
- Socket.IO uses no Redis adapter, so it runs as a single instance.
- Real telephony is not implemented (stub only).
- Money is stored as `Float` and rounded to 2 decimals in code.
- `CreateTableOrderRequest` has no `notes` in the contract yet; the API accepts an optional `notes` there as an extension.
- Delivery ETA (`[30, 40]` min) and currency (`USD`) are constants in `tenancy.service.ts`, not per-restaurant settings.
- Every tier includes `customerApp`, so `acceptingOrders` is always true today.
