import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client.js'
import { randomUUID } from 'node:crypto'
import type { AuthUser } from '../identity/auth.types.js'
import { PrismaService } from '../shared/prisma/prisma.service.js'

type JsonRecord = Record<string, unknown>

const planCatalog = [
  { id: 'P-1', name: 'Free', description: 'Run dine-in and delivery end to end', monthly: 0, yearly: 0, trialDays: 0, maxBranches: 1, maxUsers: 15, aiCredits: 300, modules: ['POS & Orders', 'Tables & Reservations', 'Kitchen Display (KDS)', 'Menu & Recipes', 'Delivery & Takeaway'], active: true },
  { id: 'P-2', name: 'Pro', description: 'Back office, stock and growth tools', monthly: 299, yearly: 2990, trialDays: 14, maxBranches: 5, maxUsers: 100, aiCredits: 3000, modules: ['POS & Orders', 'Tables & Reservations', 'Kitchen Display (KDS)', 'Menu & Recipes', 'Delivery & Takeaway', 'Inventory', 'Suppliers & Procurement', 'Customers & Loyalty', 'Online Menu', 'Social Media', 'Employees & HR', 'Reports & BI'], popular: true, active: true },
  { id: 'P-3', name: 'Enterprise', description: 'Chains with AI, finance and compliance', monthly: 1490, yearly: 14900, trialDays: 30, maxBranches: 999, maxUsers: 9999, aiCredits: 20000, modules: ['POS & Orders', 'Tables & Reservations', 'Kitchen Display (KDS)', 'Menu & Recipes', 'Delivery & Takeaway', 'Inventory', 'Suppliers & Procurement', 'Customers & Loyalty', 'Online Menu', 'Social Media', 'Employees & HR', 'Reports & BI', 'Finance & Accounting', 'Quality & Compliance', 'AI & Automation'], active: true },
]

const moduleNames = ['POS & Orders', 'Tables & Reservations', 'Kitchen Display (KDS)', 'Menu & Recipes', 'Inventory', 'Suppliers & Procurement', 'Delivery & Takeaway', 'Customers & Loyalty', 'Online Menu', 'Social Media', 'Employees & HR', 'Finance & Accounting', 'Quality & Compliance', 'Reports & BI', 'AI & Automation']
const modulePrices = [0, 19, 25, 15, 29, 25, 29, 35, 19, 29, 39, 49, 25, 39, 79]
const permissions = ['tenants.view', 'tenants.manage', 'tenants.approve', 'tenants.suspend', 'billing.view', 'billing.manage', 'billing.refund', 'users.view', 'users.manage', 'config.view', 'config.manage', 'config.flags', 'support.tickets', 'support.incidents', 'security.audit', 'security.sessions']
const roleCatalog = [
  { id: 'R-1', name: 'Super Admin', description: 'Unrestricted access to every platform capability.', permissions, system: true },
  { id: 'R-2', name: 'Platform Admin', description: 'Operates tenants, configuration and incidents.', permissions: permissions.filter((p) => !['billing.refund', 'users.manage', 'security.sessions'].includes(p)), system: true },
  { id: 'R-3', name: 'Billing Manager', description: 'Owns plans, invoices and revenue operations.', permissions: ['tenants.view', 'billing.view', 'billing.manage', 'billing.refund', 'support.tickets'], system: false },
  { id: 'R-4', name: 'Support Agent', description: 'First-line support for restaurant admins.', permissions: ['tenants.view', 'billing.view', 'support.tickets', 'config.view'], system: false },
  { id: 'R-5', name: 'Onboarding Specialist', description: 'Verifies and onboards new restaurants.', permissions: ['tenants.view', 'tenants.manage', 'tenants.approve', 'billing.view', 'support.tickets'], system: false },
  { id: 'R-6', name: 'Read-only Auditor', description: 'Read-only access for compliance reviews.', permissions: ['tenants.view', 'billing.view', 'users.view', 'config.view', 'security.audit'], system: false },
]

function asRecord(value: Prisma.JsonValue | null | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kind: string): Promise<JsonRecord[]> {
    const rows = await this.prisma.db.adminResource.findMany({ where: { kind }, orderBy: { updatedAt: 'desc' } })
    return rows.map((row) => ({ id: row.key, ...asRecord(row.data) }) as JsonRecord)
  }

  async singleton(kind: string, defaults: JsonRecord) {
    const row = await this.prisma.db.adminResource.findUnique({ where: { kind_key: { kind, key: 'default' } } })
    return { ...defaults, ...asRecord(row?.data) }
  }

  async put(kind: string, key: string, value: JsonRecord, actor?: AuthUser, audit?: { action: string; category: string }) {
    const data: JsonRecord = { ...value, id: value.id ?? key }
    await this.prisma.db.adminResource.upsert({ where: { kind_key: { kind, key } }, create: { kind, key, data: json(data) }, update: { data: json(data) } })
    if (actor && audit) await this.audit(actor, audit.action, String(data.name ?? data.title ?? data.id ?? key), audit.category)
    return data
  }

  async patch(kind: string, key: string, patch: JsonRecord, actor?: AuthUser, audit?: { action: string; category: string }) {
    const current = await this.prisma.db.adminResource.findUnique({ where: { kind_key: { kind, key } } })
    return this.put(kind, key, { ...asRecord(current?.data), ...patch, id: key }, actor, audit)
  }

  async remove(kind: string, key: string) {
    await this.prisma.db.adminResource.deleteMany({ where: { kind, key } })
    return { id: key }
  }

  async audit(actor: AuthUser, action: string, target: string, category: string) {
    const now = new Date().toISOString()
    await this.prisma.db.adminResource.create({ data: { kind: 'audit_log', key: randomUUID(), data: json({ actor: actor.name, action, target, category, ip: 'API', at: now }) } })
  }

  async tenants() {
    const restaurants = await this.prisma.db.restaurant.findMany({ include: { users: true, orders: { select: { updatedAt: true } } }, orderBy: { name: 'asc' } })
    return restaurants.map((r) => {
      const meta = asRecord(r.adminData)
      const admins = r.users.filter((u) => u.role === 'restaurant_admin')
      const latestOrder = r.orders.reduce<Date | undefined>((latest, order) => !latest || order.updatedAt > latest ? order.updatedAt : latest, undefined)
      const plan = planCatalog.find((p) => p.name === r.plan) ?? planCatalog[0]!
      return {
        id: r.id, name: r.name, legalName: meta.legalName ?? r.name, type: meta.type ?? 'Restaurant', city: meta.city ?? '', country: meta.country ?? '',
        owner: meta.owner ?? admins[0]?.name ?? '', email: meta.email ?? admins[0]?.email ?? '', phone: meta.phone ?? '', plan: r.plan,
        status: meta.status ?? 'Active', verification: meta.verification ?? 'Verified', branches: Array.isArray(r.branches) ? r.branches.length : 0,
        users: r.users.length, modules: meta.modules ?? plan.modules, mrr: meta.mrr ?? plan.monthly, ordersMonth: r.orders.length,
        usagePct: Math.min(100, Math.round((r.users.length / Math.max(1, plan.maxUsers)) * 100)), healthScore: meta.healthScore ?? 100,
        riskScore: meta.riskScore ?? 0, createdAt: r.createdAt.toISOString(), lastActive: (latestOrder ?? r.updatedAt).toISOString(), documents: meta.documents ?? [],
      }
    })
  }

  async updateTenant(id: string, patch: JsonRecord, actor: AuthUser) {
    const current = await this.prisma.db.restaurant.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Tenant not found')
    const { name, plan, branches, ...metadata } = patch
    const data: Prisma.RestaurantUpdateInput = { adminData: json({ ...asRecord(current.adminData), ...metadata }) }
    if (typeof name === 'string') data.name = name
    if (typeof plan === 'string') data.plan = plan
    if (Array.isArray(branches)) data.branches = json(branches)
    await this.prisma.db.restaurant.update({ where: { id }, data })
    await this.audit(actor, 'Updated tenant', current.name, 'Tenant')
    return patch
  }

  async createTenant(payload: JsonRecord, actor: AuthUser) {
    const name = String(payload.name ?? 'New restaurant')
    const id = String(payload.id ?? randomUUID())
    const requestedSlug = slugify(String(payload.slug ?? name)) || id
    const exists = await this.prisma.db.restaurant.findUnique({ where: { slug: requestedSlug } })
    const slug = exists ? `${requestedSlug}-${id.slice(0, 6)}` : requestedSlug
    const branches = Array.isArray(payload.branches) ? payload.branches : ['Main']
    const restaurant = await this.prisma.db.restaurant.create({ data: { id, slug, name, plan: String(payload.plan ?? 'Free'), branches: json(branches), adminData: json(payload) } })
    await this.audit(actor, 'Created tenant', name, 'Tenant')
    return { ...payload, id: restaurant.id, name: restaurant.name }
  }

  async tenantActivity() {
    const logs = await this.list('audit_log')
    return logs.filter((l) => l.category === 'Tenant').map((l) => ({ id: l.id, tenant: l.target ?? '', event: l.action ?? '', actor: l.actor ?? '', category: 'Lifecycle', at: l.at }))
  }

  async dashboard() {
    const [tenants, users, orders, onboarding] = await Promise.all([this.tenants(), this.prisma.db.user.count(), this.prisma.db.order.findMany({ include: { items: true } }), this.list('onboarding')])
    const now = new Date()
    const dayLabels = Array.from({ length: 7 }, (_, offset) => { const d = new Date(now); d.setDate(now.getDate() - (6 - offset)); return d })
    const usage = dayLabels.map((date) => {
      const dayOrders = orders.filter((o) => o.createdAt.toDateString() === date.toDateString())
      return { d: date.toLocaleDateString('en-US', { weekday: 'short' }), orders: dayOrders.length, apiCalls: 0, activeUsers: users }
    })
    const totalMrr = tenants.reduce((sum, t) => sum + Number(t.mrr ?? 0), 0)
    const revenueTrend = Array.from({ length: 12 }, (_, offset) => { const d = new Date(now.getFullYear(), now.getMonth() - (11 - offset), 1); return { m: d.toLocaleDateString('en-US', { month: 'short' }), mrr: offset === 11 ? totalMrr : 0, newMrr: 0, churned: 0 } })
    const planMix = planCatalog.map((plan) => ({ name: plan.name, value: tenants.filter((t) => t.plan === plan.name).length }))
    const stages = ['Submitted', 'Verification', 'Configuration', 'Provisioning', 'Invited', 'Live']
    const onboardingFunnel = stages.map((stage) => ({ stage, count: onboarding.filter((app) => app.stage === stage).length }))
    const dbStart = Date.now(); await this.prisma.db.$queryRaw`SELECT 1`; const latency = Date.now() - dbStart
    return { revenueTrend, usage, performance: [{ label: 'API uptime', value: `${Math.floor(process.uptime())} sec`, target: 'Running', ok: true }, { label: 'Database latency', value: `${latency} ms`, target: '< 250 ms', ok: latency < 250 }, { label: 'Stored orders', value: String(orders.length), target: 'Live', ok: true }], alerts: await this.list('platform_alert'), onboardingFunnel, planMix }
  }

  async plans() {
    const [overrides, restaurants] = await Promise.all([this.list('plan'), this.prisma.db.restaurant.findMany({ select: { plan: true } })])
    return planCatalog.map((plan) => ({ ...plan, ...overrides.find((o) => o.id === plan.id), tenants: restaurants.filter((r) => r.plan === plan.name).length }))
  }

  async modules() {
    const overrides = await this.list('module_price')
    const tiers = (name: string) => planCatalog.find((p) => p.modules.includes(name))?.name ?? 'Enterprise'
    return moduleNames.map((name, i) => ({ id: `M-${i + 1}`, name, category: ['POS & Orders', 'Tables & Reservations', 'Delivery & Takeaway', 'Customers & Loyalty'].includes(name) ? 'Front of House' : ['Kitchen Display (KDS)', 'Menu & Recipes', 'Inventory', 'Suppliers & Procurement'].includes(name) ? 'Back of House' : ['Online Menu', 'Social Media'].includes(name) ? 'Marketing' : name === 'AI & Automation' ? 'AI' : 'Management', price: modulePrices[i], perBranch: i % 3 !== 0, includedIn: tiers(name), tenants: 0, enabled: true, ...overrides.find((o) => o.id === `M-${i + 1}`) }))
  }

  async subscriptions() {
    const [tenants, overrides] = await Promise.all([this.tenants(), this.list('subscription')])
    return tenants.map((tenant) => { const plan = planCatalog.find((p) => p.name === tenant.plan) ?? planCatalog[0]!; const id = `SUB-${tenant.id}`; return { id, tenant: tenant.name, plan: tenant.plan, status: tenant.status === 'Suspended' ? 'Suspended' : 'Active', cycle: 'Monthly', amount: plan.monthly, addOns: 0, startedAt: tenant.createdAt, renewsAt: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(), autoRenew: true, ...overrides.find((o) => o.id === id) } })
  }

  async updateSubscription(id: string, patch: JsonRecord, actor: AuthUser) {
    const tenantId = id.replace(/^SUB-/, '')
    if (typeof patch.plan === 'string') await this.prisma.db.restaurant.update({ where: { id: tenantId }, data: { plan: patch.plan } })
    return this.patch('subscription', id, patch, actor, { action: 'Updated subscription', category: 'Billing' })
  }

  async billingAnalytics() {
    const subscriptions = await this.subscriptions()
    const mrr = subscriptions.filter((s) => s.status === 'Active').reduce((sum, s) => sum + Number(s.amount) + Number(s.addOns), 0)
    const m = new Date().toLocaleDateString('en-US', { month: 'short' })
    return { revenue: [{ m, actual: mrr, forecast: mrr, low: mrr, high: mrr }], churnRisk: [] }
  }

  async platformUsers() {
    const [users, invites] = await Promise.all([this.prisma.db.user.findMany({ where: { restaurantId: null }, orderBy: { name: 'asc' } }), this.list('platform_invite')])
    return [...users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: asRecord(u.adminData).role ?? 'Super Admin', team: asRecord(u.adminData).team ?? 'Leadership', status: u.status, mfa: u.mfaEnabled, lastLogin: (u.lastLoginAt ?? u.createdAt).toISOString(), tenantsManaged: Number(asRecord(u.adminData).tenantsManaged ?? 0) })), ...invites]
  }

  async updatePlatformUser(id: string, patch: JsonRecord, actor: AuthUser) {
    const user = await this.prisma.db.user.findUnique({ where: { id } })
    if (!user) return this.patch('platform_invite', id, patch, actor, { action: 'Updated platform invitation', category: 'User' })
    const { status, mfa, name, ...metadata } = patch
    await this.prisma.db.user.update({ where: { id }, data: { ...(typeof status === 'string' ? { status } : {}), ...(typeof mfa === 'boolean' ? { mfaEnabled: mfa } : {}), ...(typeof name === 'string' ? { name } : {}), adminData: json({ ...asRecord(user.adminData), ...metadata }) } })
    await this.audit(actor, 'Updated platform user', user.email, 'User')
    return patch
  }

  async invitePlatformUser(payload: JsonRecord, actor: AuthUser) {
    const id = String(payload.id ?? randomUUID())
    const invite = await this.put('platform_invite', id, { ...payload, id, status: payload.status ?? 'Invited', lastLogin: payload.lastLogin ?? new Date().toISOString() }, actor, { action: 'Invited platform user', category: 'User' })
    return invite
  }

  async roles() {
    const overrides = await this.list('platform_role')
    return roleCatalog.map((role) => ({ ...role, ...overrides.find((o) => o.id === role.id) }))
  }

  async sessions() {
    const rows = await this.prisma.db.authSession.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true }, orderBy: { lastSeenAt: 'desc' } })
    return rows.map((s) => ({ id: s.id, user: s.user.name, role: asRecord(s.user.adminData).role ?? (s.user.role === 'super_admin' ? 'Super Admin' : s.user.title), device: s.device, browser: s.browser, ip: s.ip, location: s.location, startedAt: s.startedAt.toISOString(), lastSeen: s.lastSeenAt.toISOString() }))
  }

  async revokeSession(id: string, actor: AuthUser) {
    const session = await this.prisma.db.authSession.update({ where: { id }, data: { revokedAt: new Date() }, include: { user: true } })
    await this.audit(actor, 'Revoked session', session.user.email, 'Security')
    return { id }
  }

  async loginActivity() { return this.list('login_event') }
  async auditLogs() { return this.list('audit_log') }
  async accessLogs() { return (await this.loginActivity()).map((l) => ({ id: l.id, user: l.user, action: l.event, ip: l.ip ?? 'Unknown', location: l.location ?? 'Unknown', device: l.method ?? 'Web', result: String(l.event).includes('failed') ? 'Failed' : 'Success', at: l.at })) }

  async integrations() {
    const overrides = await this.list('integration')
    const definitions = [
      { id: 'I-SONIOX', name: 'Soniox', category: 'AI', description: 'Kitchen speech and transcription', status: process.env.SONIOX_API_KEY ? 'Connected' : 'Disconnected', mode: 'Live', tenants: 0, lastSync: new Date().toISOString() },
      { id: 'I-TWILIO', name: 'Twilio', category: 'Messaging', description: 'Verification calls and SMS', status: process.env.TWILIO_ACCOUNT_SID ? 'Connected' : 'Disconnected', mode: 'Live', tenants: 0, lastSync: new Date().toISOString() },
    ]
    return definitions.map((item) => ({ ...item, ...overrides.find((o) => o.id === item.id) }))
  }

  async serviceStatuses() {
    const started = Date.now(); await this.prisma.db.$queryRaw`SELECT 1`; const latency = Date.now() - started
    return [
      { id: 'SV-API', name: 'Core API', group: 'Core', status: 'Operational', uptime: 100, latency: 0, history: Array(30).fill('ok') },
      { id: 'SV-DB', name: 'PostgreSQL', group: 'Core', status: latency < 250 ? 'Operational' : 'Degraded', uptime: 100, latency, history: Array(30).fill(latency < 250 ? 'ok' : 'warn') },
    ]
  }

  async aiUsage() {
    const tenants = await this.tenants()
    return { trend: [], byTenant: tenants.map((t) => ({ tenant: t.name, plan: t.plan, used: 0, limit: (planCatalog.find((p) => p.name === t.plan) ?? planCatalog[0]!).aiCredits, cost: 0 })), byFeature: [] }
  }
}
