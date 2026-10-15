/**
 * Super Admin Portal services.
 *
 * Every function goes through `request()` / `mutate()` from the API client, so
 * the mock data below is only used while VITE_USE_MOCKS is true.
 */
import type { Tier } from './plans'
import { moduleTier, tierInfo, TIERS } from './plans'
import { daysFromNow, minutesAgo } from '@/shared/lib/format'
import { mutate, request } from './client'

/* ────────────────────────────────────────────────────────────────────────────
 * Shared catalogues
 * ──────────────────────────────────────────────────────────────────────────── */

/** Same tiers the restaurant side is gated on (see services/plans.ts). */
export type PlanName = Tier
export const planNames: PlanName[] = TIERS

export const restaurantTypes = ['Fine Dining', 'Casual Dining', 'Quick Service (QSR)', 'Café & Bakery', 'Cloud Kitchen', 'Food Court', 'Buffet']
export const serviceModels = ['Dine-in', 'Takeaway', 'Delivery', 'Drive-thru', 'Catering', 'Reservations']

export const moduleCatalog = [
  'POS & Orders',
  'Tables & Reservations',
  'Kitchen Display (KDS)',
  'Menu & Recipes',
  'Inventory',
  'Suppliers & Procurement',
  'Delivery & Takeaway',
  'Customers & Loyalty',
  'Online Menu',
  'Social Media',
  'Employees & HR',
  'Finance & Accounting',
  'Quality & Compliance',
  'Reports & BI',
  'AI & Automation',
]

/* ────────────────────────────────────────────────────────────────────────────
 * Tenants
 * ──────────────────────────────────────────────────────────────────────────── */

export type TenantStatus = 'Active' | 'Pending' | 'Suspended' | 'Trial' | 'Inactive'
export type VerificationStatus = 'Verified' | 'In Review' | 'Pending' | 'Rejected'

export interface Tenant {
  id: string
  name: string
  legalName: string
  type: string
  city: string
  country: string
  owner: string
  email: string
  phone: string
  plan: PlanName
  status: TenantStatus
  verification: VerificationStatus
  branches: number
  users: number
  modules: string[]
  mrr: number
  ordersMonth: number
  usagePct: number
  healthScore: number
  riskScore: number
  createdAt: string
  lastActive: string
  documents: { name: string; status: VerificationStatus }[]
}

const modulesFor: Record<PlanName, string[]> = {
  Free: moduleCatalog.filter((m) => moduleTier[m] === 'Free'),
  Pro: moduleCatalog.filter((m) => moduleTier[m] !== 'Enterprise'),
  Enterprise: moduleCatalog,
}

type TenantSeed = [string, string, string, string, string, PlanName, TenantStatus, VerificationStatus, number, number, number, number, number, number]
// name, type, city, country, owner, plan, status, verification, branches, mrr, orders, usage, health, risk
const tenantSeeds: TenantSeed[] = [
  ['Spice Route Kitchen', 'Casual Dining', 'Karachi', 'Pakistan', 'Omar Siddiqui', 'Pro', 'Active', 'Verified', 3, 449, 14820, 78, 92, 12],
  ['Urban Bites', 'Quick Service (QSR)', 'Lahore', 'Pakistan', 'Hira Malik', 'Pro', 'Active', 'Verified', 5, 299, 22410, 91, 84, 22],
  ['Karachi Grill House', 'Casual Dining', 'Karachi', 'Pakistan', 'Faisal Qureshi', 'Enterprise', 'Active', 'Verified', 12, 1890, 61200, 66, 95, 8],
  ['La Piazza', 'Fine Dining', 'London', 'United Kingdom', 'Marco Bellini', 'Pro', 'Active', 'Verified', 2, 449, 6340, 54, 88, 15],
  ['Sushi Zen', 'Fine Dining', 'Dubai', 'UAE', 'Kenji Watanabe', 'Pro', 'Suspended', 'Verified', 2, 449, 1210, 12, 41, 81],
  ['The Burger Lab', 'Quick Service (QSR)', 'Islamabad', 'Pakistan', 'Ali Raza', 'Pro', 'Active', 'Verified', 4, 299, 18900, 88, 79, 34],
  ['Chai Shai Café', 'Café & Bakery', 'Lahore', 'Pakistan', 'Sana Javed', 'Free', 'Trial', 'In Review', 1, 0, 2140, 43, 70, 28],
  ['Desert Rose Dining', 'Fine Dining', 'Dubai', 'UAE', 'Layla Al Mansoori', 'Enterprise', 'Active', 'Verified', 6, 1490, 20550, 71, 90, 10],
  ['Thames Curry House', 'Casual Dining', 'London', 'United Kingdom', 'Rahul Mehta', 'Pro', 'Active', 'Verified', 3, 299, 9870, 82, 76, 38],
  ['Green Bowl', 'Quick Service (QSR)', 'Dubai', 'UAE', 'Nadia Hassan', 'Free', 'Pending', 'Pending', 1, 0, 0, 0, 0, 20],
  ['Al Noor Shawarma', 'Quick Service (QSR)', 'Karachi', 'Pakistan', 'Bilal Ahmed', 'Free', 'Active', 'Verified', 2, 99, 8400, 97, 68, 46],
  ['Pasta Fresca', 'Casual Dining', 'London', 'United Kingdom', 'Giulia Romano', 'Pro', 'Trial', 'Verified', 1, 0, 3020, 61, 74, 30],
  ['Smokehouse BBQ', 'Casual Dining', 'Islamabad', 'Pakistan', 'Usman Tariq', 'Pro', 'Active', 'Verified', 3, 449, 11240, 69, 86, 14],
  ['Dragon Wok', 'Cloud Kitchen', 'Lahore', 'Pakistan', 'Chen Wei', 'Pro', 'Suspended', 'Verified', 2, 299, 980, 9, 38, 77],
  ['Mezze & Co.', 'Casual Dining', 'Dubai', 'UAE', 'Omar Haddad', 'Pro', 'Active', 'Verified', 4, 449, 13560, 74, 89, 11],
  ['Biryani Junction', 'Cloud Kitchen', 'Karachi', 'Pakistan', 'Zainab Hussain', 'Pro', 'Pending', 'In Review', 3, 0, 0, 0, 0, 25],
  ['Café Mocha Bay', 'Café & Bakery', 'Islamabad', 'Pakistan', 'Ahmed Nawaz', 'Free', 'Inactive', 'Verified', 1, 0, 0, 0, 22, 64],
  ['Golden Fork', 'Buffet', 'London', 'United Kingdom', 'Emily Clarke', 'Enterprise', 'Active', 'Verified', 8, 1690, 30120, 63, 93, 9],
  ['Bombay Brasserie', 'Fine Dining', 'Dubai', 'UAE', 'Vikram Shah', 'Pro', 'Pending', 'Rejected', 2, 0, 0, 0, 0, 58],
  ['Lahore Tikka Co.', 'Food Court', 'Lahore', 'Pakistan', 'Kamran Butt', 'Pro', 'Active', 'Verified', 6, 299, 25300, 93, 81, 27],
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export const tenants: Tenant[] = tenantSeeds.map(
  ([name, type, city, country, owner, plan, status, verification, branches, mrr, ordersMonth, usagePct, healthScore, riskScore], i) => ({
    id: `T-${String(1001 + i)}`,
    name,
    legalName: `${name.replace('.', '')} ${country === 'Pakistan' ? '(Pvt) Ltd' : country === 'UAE' ? 'LLC' : 'Ltd'}`,
    type,
    city,
    country,
    owner,
    email: `${owner.split(' ')[0]!.toLowerCase()}@${slug(name)}.com`,
    phone: country === 'Pakistan' ? `+92 3${10 + i} ${4000000 + i * 7919}` : country === 'UAE' ? `+971 5${i % 9} ${3000000 + i * 4111}` : `+44 7${700 + i} ${100000 + i * 3331}`,
    plan,
    status,
    verification,
    branches,
    users: branches * 9 + (i % 5) * 3,
    modules: modulesFor[plan],
    mrr,
    ordersMonth,
    usagePct,
    healthScore,
    riskScore,
    createdAt: daysFromNow(-(20 + i * 23)),
    lastActive: minutesAgo(status === 'Active' ? 3 + i * 11 : 60 * 24 * (3 + i)),
    documents: [
      { name: 'Business registration certificate', status: verification === 'Rejected' ? 'Rejected' : verification },
      { name: 'Tax / NTN certificate', status: verification === 'Pending' ? 'Pending' : 'Verified' },
      { name: 'Food safety licence', status: verification === 'In Review' ? 'In Review' : verification === 'Pending' ? 'Pending' : 'Verified' },
      { name: 'Owner ID document', status: 'Verified' },
    ],
  }),
)

export interface TenantActivity {
  id: string
  tenant: string
  event: string
  actor: string
  category: 'Billing' | 'Configuration' | 'Users' | 'Orders' | 'Security' | 'Lifecycle'
  at: string
}

export const tenantActivity: TenantActivity[] = [
  { id: 'A-1', tenant: 'Karachi Grill House', event: 'Added new branch "DHA Phase 6"', actor: 'Faisal Qureshi', category: 'Configuration', at: minutesAgo(8) },
  { id: 'A-2', tenant: 'Urban Bites', event: 'Order volume spike +42% vs. 7-day average', actor: 'System', category: 'Orders', at: minutesAgo(22) },
  { id: 'A-3', tenant: 'Sushi Zen', event: 'Account suspended — 3 failed payments', actor: 'Billing automation', category: 'Lifecycle', at: minutesAgo(95) },
  { id: 'A-4', tenant: 'La Piazza', event: 'Enabled module "AI & Automation" (trial)', actor: 'Marco Bellini', category: 'Configuration', at: minutesAgo(140) },
  { id: 'A-5', tenant: 'Desert Rose Dining', event: 'Invited 6 employees', actor: 'Layla Al Mansoori', category: 'Users', at: minutesAgo(210) },
  { id: 'A-6', tenant: 'Thames Curry House', event: 'Invoice INV-2026-0912 paid', actor: 'Stripe', category: 'Billing', at: minutesAgo(300) },
  { id: 'A-7', tenant: 'The Burger Lab', event: '5 failed admin logins from new IP', actor: 'Security monitor', category: 'Security', at: minutesAgo(420) },
  { id: 'A-8', tenant: 'Chai Shai Café', event: 'Started on the Free plan', actor: 'Onboarding', category: 'Lifecycle', at: minutesAgo(600) },
  { id: 'A-9', tenant: 'Mezze & Co.', event: 'Upgraded Free → Pro', actor: 'Omar Haddad', category: 'Billing', at: minutesAgo(1300) },
  { id: 'A-10', tenant: 'Lahore Tikka Co.', event: 'Menu import: 214 items', actor: 'Kamran Butt', category: 'Configuration', at: minutesAgo(1900) },
  { id: 'A-11', tenant: 'Golden Fork', event: 'Exported monthly BI report', actor: 'Emily Clarke', category: 'Orders', at: minutesAgo(2600) },
  { id: 'A-12', tenant: 'Dragon Wok', event: 'Account suspended — policy violation', actor: 'Ayesha Khan', category: 'Lifecycle', at: minutesAgo(4300) },
]

export const getTenants = () => request<Tenant[]>('/admin/tenants', tenants)
export const getTenantActivity = () => request<TenantActivity[]>('/admin/tenants/activity', tenantActivity)
export const updateTenant = (id: string, patch: Partial<Tenant>) => mutate<Partial<Tenant>>(`/admin/tenants/${id}`, 'PATCH', patch)
export const createTenant = (tenant: Partial<Tenant>) => mutate<Partial<Tenant>>('/admin/tenants', 'POST', tenant)

/* ────────────────────────────────────────────────────────────────────────────
 * Dashboard
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PlatformAlert {
  id: string
  title: string
  detail: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  source: string
  at: string
}

export interface DashboardData {
  revenueTrend: { m: string; mrr: number; newMrr: number; churned: number }[]
  usage: { d: string; orders: number; apiCalls: number; activeUsers: number }[]
  performance: { label: string; value: string; target: string; ok: boolean }[]
  alerts: PlatformAlert[]
  onboardingFunnel: { stage: string; count: number }[]
  planMix: { name: PlanName; value: number }[]
}

const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

export const dashboardData: DashboardData = {
  revenueTrend: months.map((m, i) => ({
    m,
    mrr: Math.round(6200 + i * 520 + Math.sin(i) * 300),
    newMrr: Math.round(700 + i * 40 + (i % 3) * 120),
    churned: Math.round(180 + (i % 4) * 60),
  })),
  usage: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
    d,
    orders: [8200, 7900, 8600, 9100, 11800, 14200, 12900][i]!,
    apiCalls: [412, 398, 431, 455, 590, 712, 640][i]! * 1000,
    activeUsers: [1210, 1185, 1240, 1302, 1460, 1588, 1497][i]!,
  })),
  performance: [
    { label: 'API uptime (30d)', value: '99.97%', target: '≥ 99.9%', ok: true },
    { label: 'p95 API latency', value: '182 ms', target: '< 250 ms', ok: true },
    { label: 'POS sync success', value: '99.4%', target: '≥ 99.5%', ok: false },
    { label: 'Background job backlog', value: '312', target: '< 1,000', ok: true },
    { label: 'Error rate', value: '0.21%', target: '< 0.5%', ok: true },
  ],
  alerts: [
    { id: 'AL-1', title: 'Payment gateway latency degraded', detail: 'Stripe EU responses averaging 2.4s for the last 18 minutes.', severity: 'Critical', source: 'Payments', at: minutesAgo(18) },
    { id: 'AL-2', title: '3 tenants exceeded AI credit limit', detail: 'Urban Bites, Lahore Tikka Co. and Al Noor Shawarma hit 100% of monthly AI credits.', severity: 'High', source: 'AI usage', at: minutesAgo(47) },
    { id: 'AL-3', title: 'Sushi Zen suspended after failed payments', detail: 'Auto-suspension triggered after the 3rd failed renewal attempt.', severity: 'High', source: 'Billing', at: minutesAgo(95) },
    { id: 'AL-4', title: 'WhatsApp template rejected', detail: 'Template "order_ready_v3" was rejected by Meta — order notifications fall back to SMS.', severity: 'Medium', source: 'Messaging', at: minutesAgo(180) },
    { id: 'AL-5', title: '2 onboarding applications waiting > 48h', detail: 'Biryani Junction and Chai Shai Café are pending document verification.', severity: 'Low', source: 'Onboarding', at: minutesAgo(320) },
  ],
  onboardingFunnel: [
    { stage: 'Applied', count: 38 },
    { stage: 'Verified', count: 31 },
    { stage: 'Configured', count: 26 },
    { stage: 'Provisioned', count: 23 },
    { stage: 'Live', count: 21 },
  ],
  planMix: [
    { name: 'Free', value: 4 },
    { name: 'Pro', value: 13 },
    { name: 'Enterprise', value: 3 },
  ],
}

export const getDashboard = () => request<DashboardData>('/admin/dashboard', dashboardData)

/* ────────────────────────────────────────────────────────────────────────────
 * Onboarding applications
 * ──────────────────────────────────────────────────────────────────────────── */

export type OnboardingStage = 'Submitted' | 'Verification' | 'Configuration' | 'Provisioning' | 'Invited' | 'Live'
export const onboardingStages: OnboardingStage[] = ['Submitted', 'Verification', 'Configuration', 'Provisioning', 'Invited', 'Live']

export interface OnboardingApplication {
  id: string
  restaurant: string
  owner: string
  email: string
  city: string
  type: string
  plan: PlanName
  branches: number
  stage: OnboardingStage
  progress: number
  assignee: string
  submittedAt: string
  blocker?: string
}

export const onboardingApplications: OnboardingApplication[] = [
  { id: 'APP-2041', restaurant: 'Green Bowl', owner: 'Nadia Hassan', email: 'nadia@greenbowl.com', city: 'Dubai', type: 'Quick Service (QSR)', plan: 'Free', branches: 1, stage: 'Submitted', progress: 10, assignee: 'Sara Ahmed', submittedAt: minutesAgo(180) },
  { id: 'APP-2040', restaurant: 'Biryani Junction', owner: 'Zainab Hussain', email: 'zainab@biryanijunction.com', city: 'Karachi', type: 'Cloud Kitchen', plan: 'Pro', branches: 3, stage: 'Verification', progress: 25, assignee: 'Sara Ahmed', submittedAt: minutesAgo(3100), blocker: 'Food safety licence under review' },
  { id: 'APP-2039', restaurant: 'Chai Shai Café', owner: 'Sana Javed', email: 'sana@chaishaicafe.com', city: 'Lahore', type: 'Café & Bakery', plan: 'Free', branches: 1, stage: 'Verification', progress: 30, assignee: 'Hamza Iqbal', submittedAt: minutesAgo(3600) },
  { id: 'APP-2038', restaurant: 'Bombay Brasserie', owner: 'Vikram Shah', email: 'vikram@bombaybrasserie.com', city: 'Dubai', type: 'Fine Dining', plan: 'Pro', branches: 2, stage: 'Verification', progress: 20, assignee: 'Hamza Iqbal', submittedAt: minutesAgo(5200), blocker: 'Trade licence rejected — re-upload requested' },
  { id: 'APP-2037', restaurant: 'Tandoor Express', owner: 'Imran Shah', email: 'imran@tandoorexpress.com', city: 'Islamabad', type: 'Quick Service (QSR)', plan: 'Pro', branches: 2, stage: 'Configuration', progress: 50, assignee: 'Sara Ahmed', submittedAt: minutesAgo(6100) },
  { id: 'APP-2036', restaurant: 'Olive & Thyme', owner: 'Sophie Turner', email: 'sophie@oliveandthyme.co.uk', city: 'London', type: 'Casual Dining', plan: 'Pro', branches: 1, stage: 'Configuration', progress: 55, assignee: 'Daniel Brooks', submittedAt: minutesAgo(7300) },
  { id: 'APP-2035', restaurant: 'Seoul Kitchen', owner: 'Min-jun Park', email: 'minjun@seoulkitchen.ae', city: 'Dubai', type: 'Casual Dining', plan: 'Pro', branches: 2, stage: 'Provisioning', progress: 75, assignee: 'Daniel Brooks', submittedAt: minutesAgo(8800) },
  { id: 'APP-2034', restaurant: 'Nihari House', owner: 'Asad Mirza', email: 'asad@niharihouse.pk', city: 'Lahore', type: 'Casual Dining', plan: 'Enterprise', branches: 9, stage: 'Provisioning', progress: 80, assignee: 'Sara Ahmed', submittedAt: minutesAgo(10100) },
  { id: 'APP-2033', restaurant: 'Pasta Fresca', owner: 'Giulia Romano', email: 'giulia@pastafresca.com', city: 'London', type: 'Casual Dining', plan: 'Pro', branches: 1, stage: 'Invited', progress: 90, assignee: 'Daniel Brooks', submittedAt: minutesAgo(12600) },
  { id: 'APP-2032', restaurant: 'Mezze & Co.', owner: 'Omar Haddad', email: 'omar@mezzeandco.com', city: 'Dubai', type: 'Casual Dining', plan: 'Pro', branches: 4, stage: 'Live', progress: 100, assignee: 'Hamza Iqbal', submittedAt: minutesAgo(30000) },
  { id: 'APP-2031', restaurant: 'Smokehouse BBQ', owner: 'Usman Tariq', email: 'usman@smokehousebbq.com', city: 'Islamabad', type: 'Casual Dining', plan: 'Pro', branches: 3, stage: 'Live', progress: 100, assignee: 'Sara Ahmed', submittedAt: minutesAgo(41000) },
  { id: 'APP-2030', restaurant: 'Golden Fork', owner: 'Emily Clarke', email: 'emily@goldenfork.com', city: 'London', type: 'Buffet', plan: 'Enterprise', branches: 8, stage: 'Live', progress: 100, assignee: 'Daniel Brooks', submittedAt: minutesAgo(52000) },
]

export const getOnboardingApplications = () => request<OnboardingApplication[]>('/admin/onboarding', onboardingApplications)
export const updateOnboardingApplication = (id: string, patch: Partial<OnboardingApplication>) =>
  mutate<Partial<OnboardingApplication>>(`/admin/onboarding/${id}`, 'PATCH', patch)
export const submitOnboarding = (payload: Record<string, unknown>) => mutate<Record<string, unknown>>('/admin/onboarding', 'POST', payload)

/* ────────────────────────────────────────────────────────────────────────────
 * Subscriptions & billing
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Plan {
  id: string
  name: string
  description: string
  monthly: number
  yearly: number
  trialDays: number
  maxBranches: number
  maxUsers: number
  aiCredits: number
  modules: string[]
  tenants: number
  popular?: boolean
  active: boolean
}

export const plans: Plan[] = [
  { id: 'P-1', name: 'Free', description: tierInfo.Free.tagline, monthly: 0, yearly: 0, trialDays: 0, maxBranches: tierInfo.Free.maxBranches, maxUsers: tierInfo.Free.maxUsers, aiCredits: tierInfo.Free.voiceMinutes, modules: modulesFor.Free, tenants: 4, active: true },
  { id: 'P-2', name: 'Pro', description: tierInfo.Pro.tagline, monthly: tierInfo.Pro.monthly, yearly: tierInfo.Pro.yearly, trialDays: 14, maxBranches: tierInfo.Pro.maxBranches, maxUsers: tierInfo.Pro.maxUsers, aiCredits: tierInfo.Pro.voiceMinutes, modules: modulesFor.Pro, tenants: 13, popular: true, active: true },
  { id: 'P-3', name: 'Enterprise', description: tierInfo.Enterprise.tagline, monthly: tierInfo.Enterprise.monthly, yearly: tierInfo.Enterprise.yearly, trialDays: 30, maxBranches: tierInfo.Enterprise.maxBranches, maxUsers: tierInfo.Enterprise.maxUsers, aiCredits: tierInfo.Enterprise.voiceMinutes, modules: modulesFor.Enterprise, tenants: 3, active: true },
]

export interface ModulePrice {
  id: string
  name: string
  category: 'Front of House' | 'Back of House' | 'Marketing' | 'Management' | 'AI'
  price: number
  perBranch: boolean
  includedIn: PlanName
  tenants: number
  enabled: boolean
}

const moduleCategory = (m: string): ModulePrice['category'] =>
  ['POS & Orders', 'Tables & Reservations', 'Delivery & Takeaway', 'Customers & Loyalty'].includes(m)
    ? 'Front of House'
    : ['Kitchen Display (KDS)', 'Menu & Recipes', 'Inventory', 'Suppliers & Procurement'].includes(m)
      ? 'Back of House'
      : ['Online Menu', 'Social Media'].includes(m)
        ? 'Marketing'
        : m === 'AI & Automation'
          ? 'AI'
          : 'Management'

export const modulePrices: ModulePrice[] = moduleCatalog.map((name, i) => ({
  id: `M-${i + 1}`,
  name,
  category: moduleCategory(name),
  price: [0, 19, 25, 15, 29, 25, 29, 35, 19, 29, 39, 49, 25, 39, 79][i]!,
  perBranch: i % 3 !== 0,
  includedIn: moduleTier[name] ?? 'Enterprise',
  tenants: Math.max(2, 20 - i),
  enabled: true,
}))

export type SubscriptionStatus = 'Active' | 'Trial' | 'Overdue' | 'Cancelled' | 'Suspended'

export interface Subscription {
  id: string
  tenant: string
  plan: PlanName
  status: SubscriptionStatus
  cycle: 'Monthly' | 'Yearly'
  amount: number
  addOns: number
  startedAt: string
  renewsAt: string
  autoRenew: boolean
  trialEndsAt?: string
}

export const subscriptions: Subscription[] = tenants
  .filter((t) => t.status !== 'Pending')
  .map((t, i) => {
    const status: SubscriptionStatus =
      t.status === 'Trial' ? 'Trial' : t.status === 'Suspended' ? (i % 2 ? 'Overdue' : 'Suspended') : t.status === 'Inactive' ? 'Cancelled' : i === 8 ? 'Overdue' : 'Active'
    const plan = plans.find((p) => p.name === t.plan)!
    const cycle = i % 3 === 0 ? 'Yearly' : 'Monthly'
    return {
      id: `SUB-${3100 + i}`,
      tenant: t.name,
      plan: t.plan,
      status,
      cycle,
      amount: cycle === 'Yearly' ? plan.yearly : plan.monthly,
      addOns: (i % 4) * 25,
      startedAt: t.createdAt,
      renewsAt: daysFromNow(((i * 7) % 29) + 1),
      autoRenew: status !== 'Cancelled' && i % 5 !== 2,
      trialEndsAt: status === 'Trial' ? daysFromNow(4 + i) : undefined,
    }
  })

export interface PlanChange {
  id: string
  tenant: string
  from: PlanName
  to: PlanName
  kind: 'Upgrade' | 'Downgrade'
  mrrDelta: number
  reason: string
  status: 'Completed' | 'Scheduled' | 'Pending'
  at: string
}

export const planChanges: PlanChange[] = [
  { id: 'PC-1', tenant: 'Mezze & Co.', from: 'Pro', to: 'Pro', kind: 'Upgrade', mrrDelta: 150, reason: 'Needs inventory & procurement', status: 'Completed', at: daysFromNow(-1) },
  { id: 'PC-2', tenant: 'Karachi Grill House', from: 'Pro', to: 'Enterprise', kind: 'Upgrade', mrrDelta: 1041, reason: 'Opened 4 new branches', status: 'Completed', at: daysFromNow(-6) },
  { id: 'PC-3', tenant: 'Al Noor Shawarma', from: 'Pro', to: 'Free', kind: 'Downgrade', mrrDelta: -200, reason: 'Closed delivery operations', status: 'Completed', at: daysFromNow(-9) },
  { id: 'PC-4', tenant: 'Urban Bites', from: 'Pro', to: 'Pro', kind: 'Upgrade', mrrDelta: 150, reason: 'Usage at 91% of plan', status: 'Pending', at: daysFromNow(0) },
  { id: 'PC-5', tenant: 'Thames Curry House', from: 'Pro', to: 'Pro', kind: 'Downgrade', mrrDelta: -150, reason: 'Cost reduction', status: 'Scheduled', at: daysFromNow(12) },
  { id: 'PC-6', tenant: 'Lahore Tikka Co.', from: 'Free', to: 'Pro', kind: 'Upgrade', mrrDelta: 200, reason: 'Added loyalty programme', status: 'Completed', at: daysFromNow(-21) },
  { id: 'PC-7', tenant: 'Golden Fork', from: 'Pro', to: 'Enterprise', kind: 'Upgrade', mrrDelta: 1241, reason: 'Franchise roll-out', status: 'Completed', at: daysFromNow(-34) },
  { id: 'PC-8', tenant: 'Pasta Fresca', from: 'Free', to: 'Pro', kind: 'Upgrade', mrrDelta: 200, reason: 'Trial conversion', status: 'Scheduled', at: daysFromNow(6) },
]

export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Failed' | 'Refunded'

export interface Invoice {
  id: string
  tenant: string
  amount: number
  tax: number
  status: InvoiceStatus
  method: 'Card' | 'Bank transfer' | 'JazzCash' | 'Easypaisa' | 'Direct debit'
  issuedAt: string
  dueAt: string
  paidAt?: string
}

const invoiceStatuses: InvoiceStatus[] = ['Paid', 'Paid', 'Paid', 'Pending', 'Paid', 'Overdue', 'Paid', 'Failed', 'Paid', 'Paid', 'Pending', 'Paid', 'Refunded', 'Paid', 'Overdue', 'Paid']
const methods: Invoice['method'][] = ['Card', 'Bank transfer', 'JazzCash', 'Card', 'Direct debit', 'Easypaisa']

export const invoices: Invoice[] = invoiceStatuses.map((status, i) => {
  const sub = subscriptions[i % subscriptions.length]!
  const amount = sub.amount + sub.addOns
  return {
    id: `INV-2026-${String(920 - i).padStart(4, '0')}`,
    tenant: sub.tenant,
    amount,
    tax: Math.round(amount * 0.16),
    status,
    method: methods[i % methods.length]!,
    issuedAt: daysFromNow(-(i * 3 + 1)),
    dueAt: daysFromNow(-(i * 3 + 1) + 14),
    paidAt: status === 'Paid' ? daysFromNow(-(i * 3)) : undefined,
  }
})

export interface RenewalRule {
  id: string
  name: string
  trigger: string
  channels: ('Email' | 'SMS' | 'WhatsApp' | 'In-app')[]
  enabled: boolean
  sentThisMonth: number
}

export const renewalRules: RenewalRule[] = [
  { id: 'R-1', name: 'Renewal reminder', trigger: '7 days before renewal', channels: ['Email', 'In-app'], enabled: true, sentThisMonth: 42 },
  { id: 'R-2', name: 'Final renewal reminder', trigger: '1 day before renewal', channels: ['Email', 'WhatsApp'], enabled: true, sentThisMonth: 37 },
  { id: 'R-3', name: 'Trial ending', trigger: '3 days before trial ends', channels: ['Email', 'SMS', 'In-app'], enabled: true, sentThisMonth: 9 },
  { id: 'R-4', name: 'Payment failed — dunning #1', trigger: 'On failed payment', channels: ['Email', 'SMS'], enabled: true, sentThisMonth: 6 },
  { id: 'R-5', name: 'Payment failed — dunning #2', trigger: '3 days after failed payment', channels: ['Email', 'WhatsApp'], enabled: true, sentThisMonth: 3 },
  { id: 'R-6', name: 'Suspension warning', trigger: '7 days after failed payment', channels: ['Email', 'SMS', 'WhatsApp'], enabled: false, sentThisMonth: 0 },
]

export interface BillingData {
  revenue: { m: string; actual?: number; forecast?: number; low?: number; high?: number }[]
  churnRisk: { tenant: string; probability: number; mrr: number; reason: string }[]
}

export const billingData: BillingData = {
  revenue: [
    ...months.slice(4).map((m, i) => ({ m, actual: Math.round(8300 + i * 560 + Math.sin(i) * 250) })),
    { m: 'Nov', forecast: 13400, low: 12700, high: 14100 },
    { m: 'Dec', forecast: 14300, low: 13300, high: 15300 },
    { m: 'Jan', forecast: 14900, low: 13600, high: 16200 },
  ],
  churnRisk: [
    { tenant: 'Sushi Zen', probability: 86, mrr: 449, reason: '3 failed payments, usage down 88%' },
    { tenant: 'Dragon Wok', probability: 74, mrr: 299, reason: 'Suspended, no logins in 9 days' },
    { tenant: 'Café Mocha Bay', probability: 69, mrr: 99, reason: 'Cancelled — win-back candidate' },
    { tenant: 'Thames Curry House', probability: 41, mrr: 299, reason: 'Scheduled downgrade, 2 open complaints' },
    { tenant: 'Al Noor Shawarma', probability: 33, mrr: 99, reason: 'Hit plan limits, price-sensitive' },
  ],
}
// Last actual month connects to the forecast line.
billingData.revenue[7] = { ...billingData.revenue[7]!, forecast: billingData.revenue[7]!.actual }

export const getPlans = () => request<Plan[]>('/admin/plans', plans)
export const savePlan = (plan: Plan) => mutate<Plan>(`/admin/plans/${plan.id}`, 'PUT', plan)
export const createPlan = (plan: Plan) => mutate<Plan>('/admin/plans', 'POST', plan)
export const getModulePrices = () => request<ModulePrice[]>('/admin/modules/pricing', modulePrices)
export const updateModulePrice = (id: string, patch: Partial<ModulePrice>) => mutate<Partial<ModulePrice>>(`/admin/modules/pricing/${id}`, 'PATCH', patch)
export const getSubscriptions = () => request<Subscription[]>('/admin/subscriptions', subscriptions)
export const updateSubscription = (id: string, patch: Partial<Subscription>) => mutate<Partial<Subscription>>(`/admin/subscriptions/${id}`, 'PATCH', patch)
export const getPlanChanges = () => request<PlanChange[]>('/admin/subscriptions/changes', planChanges)
export const createPlanChange = (change: PlanChange) => mutate<PlanChange>('/admin/subscriptions/changes', 'POST', change)
export const getInvoices = () => request<Invoice[]>('/admin/invoices', invoices)
export const updateInvoice = (id: string, patch: Partial<Invoice>) => mutate<Partial<Invoice>>(`/admin/invoices/${id}`, 'PATCH', patch)
export const getRenewalRules = () => request<RenewalRule[]>('/admin/billing/renewal-rules', renewalRules)
export const updateRenewalRule = (id: string, patch: Partial<RenewalRule>) => mutate<Partial<RenewalRule>>(`/admin/billing/renewal-rules/${id}`, 'PATCH', patch)
export const getBillingData = () => request<BillingData>('/admin/billing/analytics', billingData)

/* ────────────────────────────────────────────────────────────────────────────
 * Platform users & access
 * ──────────────────────────────────────────────────────────────────────────── */

export type PlatformRoleName = 'Super Admin' | 'Platform Admin' | 'Billing Manager' | 'Support Agent' | 'Onboarding Specialist' | 'Read-only Auditor'
export const platformRoleNames: PlatformRoleName[] = ['Super Admin', 'Platform Admin', 'Billing Manager', 'Support Agent', 'Onboarding Specialist', 'Read-only Auditor']

export interface PlatformUser {
  id: string
  name: string
  email: string
  role: PlatformRoleName
  team: 'Leadership' | 'Operations' | 'Finance' | 'Support' | 'Customer Success' | 'Compliance'
  status: 'Active' | 'Invited' | 'Suspended' | 'Inactive'
  mfa: boolean
  lastLogin: string
  tenantsManaged: number
}

export const platformUsers: PlatformUser[] = [
  { id: 'U-001', name: 'Ayesha Khan', email: 'ayesha@restaurantos.io', role: 'Super Admin', team: 'Leadership', status: 'Active', mfa: true, lastLogin: minutesAgo(2), tenantsManaged: 20 },
  { id: 'U-002', name: 'Bilal Chaudhry', email: 'bilal@restaurantos.io', role: 'Super Admin', team: 'Leadership', status: 'Active', mfa: true, lastLogin: minutesAgo(64), tenantsManaged: 20 },
  { id: 'U-003', name: 'Sara Ahmed', email: 'sara@restaurantos.io', role: 'Onboarding Specialist', team: 'Customer Success', status: 'Active', mfa: true, lastLogin: minutesAgo(12), tenantsManaged: 7 },
  { id: 'U-004', name: 'Hamza Iqbal', email: 'hamza@restaurantos.io', role: 'Onboarding Specialist', team: 'Customer Success', status: 'Active', mfa: true, lastLogin: minutesAgo(140), tenantsManaged: 5 },
  { id: 'U-005', name: 'Daniel Brooks', email: 'daniel@restaurantos.io', role: 'Platform Admin', team: 'Operations', status: 'Active', mfa: true, lastLogin: minutesAgo(33), tenantsManaged: 6 },
  { id: 'U-006', name: 'Fatima Noor', email: 'fatima@restaurantos.io', role: 'Billing Manager', team: 'Finance', status: 'Active', mfa: true, lastLogin: minutesAgo(250), tenantsManaged: 0 },
  { id: 'U-007', name: 'Zain Abbas', email: 'zain@restaurantos.io', role: 'Support Agent', team: 'Support', status: 'Active', mfa: false, lastLogin: minutesAgo(7), tenantsManaged: 0 },
  { id: 'U-008', name: 'Mariam Yousuf', email: 'mariam@restaurantos.io', role: 'Support Agent', team: 'Support', status: 'Active', mfa: true, lastLogin: minutesAgo(19), tenantsManaged: 0 },
  { id: 'U-009', name: 'James Whitaker', email: 'james@restaurantos.io', role: 'Support Agent', team: 'Support', status: 'Suspended', mfa: false, lastLogin: minutesAgo(60 * 24 * 12), tenantsManaged: 0 },
  { id: 'U-010', name: 'Aisha Rahman', email: 'aisha@restaurantos.io', role: 'Read-only Auditor', team: 'Compliance', status: 'Invited', mfa: false, lastLogin: minutesAgo(60 * 24 * 30), tenantsManaged: 0 },
  { id: 'U-011', name: 'Rizwan Haider', email: 'rizwan@restaurantos.io', role: 'Platform Admin', team: 'Operations', status: 'Active', mfa: true, lastLogin: minutesAgo(480), tenantsManaged: 4 },
  { id: 'U-012', name: 'Noah Patel', email: 'noah@restaurantos.io', role: 'Billing Manager', team: 'Finance', status: 'Inactive', mfa: true, lastLogin: minutesAgo(60 * 24 * 45), tenantsManaged: 0 },
]

export interface PermissionDef {
  id: string
  label: string
  group: 'Tenants' | 'Billing' | 'Users' | 'Configuration' | 'Support' | 'Security'
}

export const permissionCatalog: PermissionDef[] = [
  { id: 'tenants.view', label: 'View restaurants', group: 'Tenants' },
  { id: 'tenants.manage', label: 'Create & edit restaurants', group: 'Tenants' },
  { id: 'tenants.approve', label: 'Verify & approve restaurants', group: 'Tenants' },
  { id: 'tenants.suspend', label: 'Suspend / deactivate restaurants', group: 'Tenants' },
  { id: 'billing.view', label: 'View billing & invoices', group: 'Billing' },
  { id: 'billing.manage', label: 'Manage plans & pricing', group: 'Billing' },
  { id: 'billing.refund', label: 'Issue refunds & credits', group: 'Billing' },
  { id: 'users.view', label: 'View platform users', group: 'Users' },
  { id: 'users.manage', label: 'Invite & manage users', group: 'Users' },
  { id: 'config.view', label: 'View configuration', group: 'Configuration' },
  { id: 'config.manage', label: 'Change system settings & integrations', group: 'Configuration' },
  { id: 'config.flags', label: 'Toggle feature flags', group: 'Configuration' },
  { id: 'support.tickets', label: 'Handle support tickets', group: 'Support' },
  { id: 'support.incidents', label: 'Manage incidents & escalations', group: 'Support' },
  { id: 'security.audit', label: 'View audit & access logs', group: 'Security' },
  { id: 'security.sessions', label: 'Revoke sessions & reset MFA', group: 'Security' },
]

export interface PlatformRole {
  id: string
  name: PlatformRoleName
  description: string
  permissions: string[]
  system: boolean
}

const all = permissionCatalog.map((p) => p.id)
export const platformRoles: PlatformRole[] = [
  { id: 'R-1', name: 'Super Admin', description: 'Unrestricted access to every platform capability.', permissions: all, system: true },
  { id: 'R-2', name: 'Platform Admin', description: 'Operates tenants, configuration and incidents.', permissions: all.filter((p) => !['billing.refund', 'users.manage', 'security.sessions'].includes(p)), system: true },
  { id: 'R-3', name: 'Billing Manager', description: 'Owns plans, invoices and revenue operations.', permissions: ['tenants.view', 'billing.view', 'billing.manage', 'billing.refund', 'support.tickets'], system: false },
  { id: 'R-4', name: 'Support Agent', description: 'First-line support for restaurant admins.', permissions: ['tenants.view', 'billing.view', 'support.tickets', 'config.view'], system: false },
  { id: 'R-5', name: 'Onboarding Specialist', description: 'Verifies and onboards new restaurants.', permissions: ['tenants.view', 'tenants.manage', 'tenants.approve', 'billing.view', 'support.tickets'], system: false },
  { id: 'R-6', name: 'Read-only Auditor', description: 'Read-only access for compliance reviews.', permissions: ['tenants.view', 'billing.view', 'users.view', 'config.view', 'security.audit'], system: false },
]

export interface AdminAssignment {
  id: string
  tenant: string
  admin: string
  email: string
  accountManager: string
  status: 'Active' | 'Invited' | 'Pending' | 'Suspended'
  assignedAt: string
}

export const adminAssignments: AdminAssignment[] = tenants.slice(0, 14).map((t, i) => ({
  id: `AS-${i + 1}`,
  tenant: t.name,
  admin: t.owner,
  email: t.email,
  accountManager: ['Sara Ahmed', 'Hamza Iqbal', 'Daniel Brooks', 'Rizwan Haider'][i % 4]!,
  status: t.status === 'Pending' ? 'Pending' : t.status === 'Suspended' ? 'Suspended' : t.status === 'Trial' ? 'Invited' : 'Active',
  assignedAt: t.createdAt,
}))

export interface AccessLog {
  id: string
  user: string
  action: string
  ip: string
  location: string
  device: string
  result: 'Success' | 'Failed' | 'Blocked'
  at: string
}

const logActions = ['Signed in', 'Viewed tenant Karachi Grill House', 'Changed plan pricing', 'Exported invoices', 'Reset MFA for Zain Abbas', 'Signed in', 'Suspended tenant Sushi Zen', 'Failed MFA challenge', 'Updated feature flag "ai_menu_engineering"', 'Signed in', 'Revoked session', 'Viewed audit logs', 'Signed in', 'Password changed', 'Signed in', 'API key rotated']
const locations = ['Karachi, PK', 'Lahore, PK', 'Islamabad, PK', 'Dubai, AE', 'London, GB']
export const accessLogs: AccessLog[] = logActions.map((action, i) => ({
  id: `LOG-${5000 - i}`,
  user: platformUsers[i % platformUsers.length]!.name,
  action,
  ip: `${[39, 182, 94, 5, 86][i % 5]}.${(i * 37) % 255}.${(i * 13) % 255}.${(i * 71) % 255}`,
  location: i === 7 ? 'Lagos, NG' : i === 10 ? 'Unknown (Tor exit node)' : locations[i % locations.length]!,
  device: ['Chrome · Windows', 'Safari · macOS', 'Edge · Windows', 'Chrome · Android', 'Safari · iOS'][i % 5]!,
  result: i === 7 ? 'Failed' : i === 10 ? 'Blocked' : 'Success',
  at: minutesAgo(3 + i * 41),
}))

export interface SuspiciousActivity {
  id: string
  subject: string
  scope: 'Platform user' | 'Restaurant admin'
  pattern: string
  detail: string
  risk: 'Critical' | 'High' | 'Medium' | 'Low'
  confidence: number
  status: 'Open' | 'Investigating' | 'Resolved' | 'Dismissed'
  at: string
}

export const suspiciousActivity: SuspiciousActivity[] = [
  { id: 'SA-1', subject: 'James Whitaker', scope: 'Platform user', pattern: 'Impossible travel', detail: 'Login from London, then Lagos 14 minutes later.', risk: 'Critical', confidence: 96, status: 'Investigating', at: minutesAgo(290) },
  { id: 'SA-2', subject: 'admin@theburgerlab.com', scope: 'Restaurant admin', pattern: 'Credential stuffing', detail: '5 failed logins from 3 IPs within 2 minutes.', risk: 'High', confidence: 91, status: 'Open', at: minutesAgo(420) },
  { id: 'SA-3', subject: 'Zain Abbas', scope: 'Platform user', pattern: 'Unusual data export', detail: 'Exported 4× more tenant records than 30-day baseline.', risk: 'Medium', confidence: 78, status: 'Open', at: minutesAgo(700) },
  { id: 'SA-4', subject: 'owner@dragonwok.com', scope: 'Restaurant admin', pattern: 'Refund abuse', detail: '22 voids/refunds after close of business.', risk: 'High', confidence: 84, status: 'Resolved', at: minutesAgo(4300) },
  { id: 'SA-5', subject: 'Unknown', scope: 'Platform user', pattern: 'Tor exit node', detail: 'Blocked sign-in attempt for bilal@restaurantos.io.', risk: 'Medium', confidence: 88, status: 'Dismissed', at: minutesAgo(5000) },
]

export const getPlatformUsers = () => request<PlatformUser[]>('/admin/users', platformUsers)
export const inviteUser = (u: PlatformUser) => mutate<PlatformUser>('/admin/users', 'POST', u)
export const updatePlatformUser = (id: string, patch: Partial<PlatformUser>) => mutate<Partial<PlatformUser>>(`/admin/users/${id}`, 'PATCH', patch)
export const getPlatformRoles = () => request<PlatformRole[]>('/admin/roles', platformRoles)
export const savePlatformRole = (role: PlatformRole) => mutate<PlatformRole>(`/admin/roles/${role.id}`, 'PUT', role)
export const getAdminAssignments = () => request<AdminAssignment[]>('/admin/assignments', adminAssignments)
export const saveAdminAssignment = (a: AdminAssignment) => mutate<AdminAssignment>(`/admin/assignments/${a.id}`, 'PUT', a)
export const getAccessLogs = () => request<AccessLog[]>('/admin/access-logs', accessLogs)
export const getSuspiciousActivity = () => request<SuspiciousActivity[]>('/admin/security/suspicious', suspiciousActivity)
export const updateSuspiciousActivity = (id: string, patch: Partial<SuspiciousActivity>) =>
  mutate<Partial<SuspiciousActivity>>(`/admin/security/suspicious/${id}`, 'PATCH', patch)

/* ────────────────────────────────────────────────────────────────────────────
 * Authentication & security
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SecurityPolicy {
  mfaRequired: boolean
  mfaMethods: { authenticator: boolean; sms: boolean; email: boolean; securityKey: boolean }
  mfaGraceDays: number
  rememberDeviceDays: number
  passwordMinLength: number
  passwordRequireSymbols: boolean
  passwordRequireNumbers: boolean
  passwordRequireMixedCase: boolean
  passwordExpiryDays: number
  passwordHistory: number
  lockoutAttempts: number
  resetLinkMinutes: number
  sessionIdleMinutes: number
  sessionMaxHours: number
  singleSession: boolean
  ipAllowlist: string
}

export const securityPolicy: SecurityPolicy = {
  mfaRequired: true,
  mfaMethods: { authenticator: true, sms: true, email: false, securityKey: true },
  mfaGraceDays: 3,
  rememberDeviceDays: 14,
  passwordMinLength: 12,
  passwordRequireSymbols: true,
  passwordRequireNumbers: true,
  passwordRequireMixedCase: true,
  passwordExpiryDays: 90,
  passwordHistory: 5,
  lockoutAttempts: 5,
  resetLinkMinutes: 30,
  sessionIdleMinutes: 30,
  sessionMaxHours: 12,
  singleSession: false,
  ipAllowlist: '39.32.0.0/16\n182.180.0.0/16',
}

export interface ResetRequest {
  id: string
  user: string
  email: string
  channel: 'Email link' | 'SMS OTP' | 'Admin reset'
  status: 'Completed' | 'Pending' | 'Expired' | 'Blocked'
  ip: string
  at: string
}

export const resetRequests: ResetRequest[] = [
  { id: 'PR-1', user: 'Zain Abbas', email: 'zain@restaurantos.io', channel: 'Email link', status: 'Completed', ip: '39.45.12.8', at: minutesAgo(90) },
  { id: 'PR-2', user: 'Hira Malik', email: 'hira@urbanbites.com', channel: 'SMS OTP', status: 'Completed', ip: '182.185.3.44', at: minutesAgo(240) },
  { id: 'PR-3', user: 'James Whitaker', email: 'james@restaurantos.io', channel: 'Email link', status: 'Blocked', ip: '105.112.4.9', at: minutesAgo(300) },
  { id: 'PR-4', user: 'Aisha Rahman', email: 'aisha@restaurantos.io', channel: 'Admin reset', status: 'Pending', ip: '—', at: minutesAgo(480) },
  { id: 'PR-5', user: 'Marco Bellini', email: 'marco@lapiazza.com', channel: 'Email link', status: 'Expired', ip: '86.12.140.3', at: minutesAgo(1500) },
  { id: 'PR-6', user: 'Ali Raza', email: 'ali@theburgerlab.com', channel: 'Email link', status: 'Completed', ip: '94.200.71.18', at: minutesAgo(2900) },
  { id: 'PR-7', user: 'Noah Patel', email: 'noah@restaurantos.io', channel: 'SMS OTP', status: 'Expired', ip: '5.31.66.2', at: minutesAgo(6100) },
]

export interface ActiveSession {
  id: string
  user: string
  role: string
  device: string
  browser: string
  ip: string
  location: string
  startedAt: string
  lastSeen: string
  current?: boolean
}

export const activeSessions: ActiveSession[] = [
  { id: 'S-1', user: 'Ayesha Khan', role: 'Super Admin', device: 'Windows 11 laptop', browser: 'Chrome 129', ip: '39.32.18.4', location: 'Karachi, PK', startedAt: minutesAgo(140), lastSeen: minutesAgo(0), current: true },
  { id: 'S-2', user: 'Ayesha Khan', role: 'Super Admin', device: 'iPhone 15', browser: 'Safari iOS', ip: '39.32.90.12', location: 'Karachi, PK', startedAt: minutesAgo(1300), lastSeen: minutesAgo(55) },
  { id: 'S-3', user: 'Bilal Chaudhry', role: 'Super Admin', device: 'MacBook Pro', browser: 'Safari 18', ip: '182.180.4.21', location: 'Lahore, PK', startedAt: minutesAgo(300), lastSeen: minutesAgo(64) },
  { id: 'S-4', user: 'Sara Ahmed', role: 'Onboarding Specialist', device: 'Windows 10 desktop', browser: 'Edge 129', ip: '39.40.12.88', location: 'Karachi, PK', startedAt: minutesAgo(200), lastSeen: minutesAgo(12) },
  { id: 'S-5', user: 'Daniel Brooks', role: 'Platform Admin', device: 'MacBook Air', browser: 'Chrome 129', ip: '86.12.45.199', location: 'London, GB', startedAt: minutesAgo(90), lastSeen: minutesAgo(33) },
  { id: 'S-6', user: 'Zain Abbas', role: 'Support Agent', device: 'Android phone', browser: 'Chrome Mobile', ip: '39.45.12.8', location: 'Islamabad, PK', startedAt: minutesAgo(45), lastSeen: minutesAgo(7) },
  { id: 'S-7', user: 'Mariam Yousuf', role: 'Support Agent', device: 'Windows 11 laptop', browser: 'Firefox 131', ip: '94.200.71.4', location: 'Dubai, AE', startedAt: minutesAgo(400), lastSeen: minutesAgo(19) },
  { id: 'S-8', user: 'Rizwan Haider', role: 'Platform Admin', device: 'iPad Pro', browser: 'Safari iPadOS', ip: '182.181.66.3', location: 'Lahore, PK', startedAt: minutesAgo(700), lastSeen: minutesAgo(480) },
]

export interface LoginEvent {
  id: string
  user: string
  event: 'Login success' | 'Login failed' | 'MFA passed' | 'MFA failed' | 'Logout' | 'Account locked' | 'Password reset'
  method: string
  ip: string
  location: string
  at: string
}

const loginEvents: LoginEvent['event'][] = ['Login success', 'MFA passed', 'Login failed', 'Login success', 'MFA failed', 'Logout', 'Login success', 'Account locked', 'Password reset', 'MFA passed', 'Login success', 'Logout', 'Login failed', 'Login success']
export const loginActivity: LoginEvent[] = loginEvents.map((event, i) => ({
  id: `LE-${9000 - i}`,
  user: platformUsers[(i * 5) % platformUsers.length]!.email,
  event,
  method: event.startsWith('MFA') ? ['Authenticator app', 'SMS OTP', 'Security key'][i % 3]! : 'Password',
  ip: `${[39, 182, 94, 86, 105][i % 5]}.${(i * 29) % 255}.${(i * 17) % 255}.${(i * 53) % 255}`,
  location: event === 'Account locked' ? 'Lagos, NG' : locations[i % locations.length]!,
  at: minutesAgo(2 + i * 37),
}))

export const loginTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({
  d,
  success: [142, 151, 138, 160, 171, 96, 88][i]!,
  failed: [6, 4, 9, 5, 14, 3, 2][i]!,
}))

export interface AuditLog {
  id: string
  actor: string
  action: string
  target: string
  category: 'Security' | 'Tenant' | 'Billing' | 'Config' | 'User'
  ip: string
  at: string
}

export const auditLogs: AuditLog[] = [
  { id: 'AU-1', actor: 'Ayesha Khan', action: 'Updated MFA policy', target: 'Security policy', category: 'Security', ip: '39.32.18.4', at: minutesAgo(30) },
  { id: 'AU-2', actor: 'Bilal Chaudhry', action: 'Suspended tenant', target: 'Dragon Wok', category: 'Tenant', ip: '182.180.4.21', at: minutesAgo(4300) },
  { id: 'AU-3', actor: 'Fatima Noor', action: 'Issued credit note', target: 'INV-2026-0908', category: 'Billing', ip: '39.48.2.77', at: minutesAgo(520) },
  { id: 'AU-4', actor: 'Daniel Brooks', action: 'Rotated API key', target: 'Foodpanda integration', category: 'Config', ip: '86.12.45.199', at: minutesAgo(610) },
  { id: 'AU-5', actor: 'Ayesha Khan', action: 'Revoked session', target: 'James Whitaker · Chrome Android', category: 'Security', ip: '39.32.18.4', at: minutesAgo(290) },
  { id: 'AU-6', actor: 'Sara Ahmed', action: 'Approved restaurant', target: 'Mezze & Co.', category: 'Tenant', ip: '39.40.12.88', at: minutesAgo(30000) },
  { id: 'AU-7', actor: 'Rizwan Haider', action: 'Enabled feature flag', target: 'kds_voice_alerts (25%)', category: 'Config', ip: '182.181.66.3', at: minutesAgo(1440) },
  { id: 'AU-8', actor: 'Ayesha Khan', action: 'Invited user', target: 'aisha@restaurantos.io', category: 'User', ip: '39.32.18.4', at: minutesAgo(43000) },
  { id: 'AU-9', actor: 'Fatima Noor', action: 'Changed plan price', target: 'Pro: $399 → $449', category: 'Billing', ip: '39.48.2.77', at: minutesAgo(20000) },
  { id: 'AU-10', actor: 'Bilal Chaudhry', action: 'Suspended user', target: 'James Whitaker', category: 'User', ip: '182.180.4.21', at: minutesAgo(17000) },
]

export const getSecurityPolicy = () => request<SecurityPolicy>('/admin/security/policy', securityPolicy)
export const saveSecurityPolicy = (p: SecurityPolicy) => mutate<SecurityPolicy>('/admin/security/policy', 'PUT', p)
export const getResetRequests = () => request<ResetRequest[]>('/admin/security/password-resets', resetRequests)
export const getActiveSessions = () => request<ActiveSession[]>('/admin/security/sessions', activeSessions)
export const revokeSession = (id: string) => mutate<{ id: string }>(`/admin/security/sessions/${id}`, 'DELETE', { id })
export const getLoginActivity = () => request<LoginEvent[]>('/admin/security/login-activity', loginActivity)
export const getAuditLogs = () => request<AuditLog[]>('/admin/security/audit-logs', auditLogs)

/* ────────────────────────────────────────────────────────────────────────────
 * Platform configuration & integrations
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GlobalSettings {
  platformName: string
  supportEmail: string
  defaultCurrency: string
  defaultTimezone: string
  defaultLanguage: string
  dataRegion: string
  maintenanceMode: boolean
  allowSelfSignup: boolean
  requireVerification: boolean
  dataRetentionDays: number
}

export const globalSettings: GlobalSettings = {
  platformName: 'RestaurantOS',
  supportEmail: 'support@restaurantos.io',
  defaultCurrency: 'USD',
  defaultTimezone: 'Asia/Karachi',
  defaultLanguage: 'English',
  dataRegion: 'Middle East (Bahrain)',
  maintenanceMode: false,
  allowSelfSignup: true,
  requireVerification: true,
  dataRetentionDays: 730,
}

export interface Integration {
  id: string
  name: string
  category: 'Payment' | 'Messaging' | 'AI' | 'Delivery' | 'Accounting' | 'Maps' | 'Analytics' | 'Social'
  description: string
  status: 'Connected' | 'Disconnected' | 'Degraded' | 'Failed'
  mode?: 'Live' | 'Sandbox'
  tenants: number
  lastSync: string
  apiKey?: string
}

export const integrations: Integration[] = [
  { id: 'I-1', name: 'Stripe', category: 'Payment', description: 'Cards, Apple Pay & Google Pay (UK, UAE)', status: 'Degraded', mode: 'Live', tenants: 9, lastSync: minutesAgo(1), apiKey: 'sk_live_••••••••4f2a' },
  { id: 'I-2', name: 'JazzCash', category: 'Payment', description: 'Mobile wallet payments (Pakistan)', status: 'Connected', mode: 'Live', tenants: 8, lastSync: minutesAgo(2), apiKey: 'jc_••••••••91be' },
  { id: 'I-3', name: 'Easypaisa', category: 'Payment', description: 'Mobile wallet payments (Pakistan)', status: 'Connected', mode: 'Live', tenants: 6, lastSync: minutesAgo(4), apiKey: 'ep_••••••••2c10' },
  { id: 'I-4', name: 'PayTabs', category: 'Payment', description: 'Regional card acquiring (GCC)', status: 'Disconnected', mode: 'Sandbox', tenants: 0, lastSync: minutesAgo(60 * 24 * 6) },
  { id: 'I-5', name: 'SendGrid', category: 'Messaging', description: 'Transactional email', status: 'Connected', tenants: 20, lastSync: minutesAgo(1), apiKey: 'SG.••••••••a8Qe' },
  { id: 'I-6', name: 'Twilio SMS', category: 'Messaging', description: 'OTP and order SMS', status: 'Connected', tenants: 17, lastSync: minutesAgo(3), apiKey: 'AC••••••••77d1' },
  { id: 'I-7', name: 'WhatsApp Business (Meta)', category: 'Messaging', description: 'Order updates & marketing templates', status: 'Degraded', tenants: 12, lastSync: minutesAgo(9), apiKey: 'EAAG••••••••ZD' },
  { id: 'I-8', name: 'OpenAI', category: 'AI', description: 'GPT models for copilot & content', status: 'Connected', tenants: 15, lastSync: minutesAgo(1), apiKey: 'sk-proj-••••••••x9' },
  { id: 'I-9', name: 'Anthropic Claude', category: 'AI', description: 'Claude models for analysis & insights', status: 'Connected', tenants: 15, lastSync: minutesAgo(1), apiKey: 'sk-ant-••••••••Qa' },
  { id: 'I-10', name: 'Foodpanda', category: 'Delivery', description: 'Aggregator order injection', status: 'Connected', tenants: 9, lastSync: minutesAgo(2) },
  { id: 'I-11', name: 'Talabat', category: 'Delivery', description: 'Aggregator order injection (UAE)', status: 'Failed', tenants: 4, lastSync: minutesAgo(130) },
  { id: 'I-12', name: 'Deliveroo', category: 'Delivery', description: 'Aggregator order injection (UK)', status: 'Connected', tenants: 3, lastSync: minutesAgo(5) },
  { id: 'I-13', name: 'QuickBooks Online', category: 'Accounting', description: 'Sync sales & expenses', status: 'Connected', tenants: 5, lastSync: minutesAgo(45) },
  { id: 'I-14', name: 'Xero', category: 'Accounting', description: 'Sync sales & expenses', status: 'Disconnected', tenants: 0, lastSync: minutesAgo(60 * 24 * 20) },
  { id: 'I-15', name: 'Google Maps Platform', category: 'Maps', description: 'Delivery zones & rider routing', status: 'Connected', tenants: 13, lastSync: minutesAgo(1) },
  { id: 'I-16', name: 'Meta Graph API', category: 'Social', description: 'Instagram & Facebook publishing', status: 'Connected', tenants: 8, lastSync: minutesAgo(12) },
  { id: 'I-17', name: 'Mixpanel', category: 'Analytics', description: 'Product analytics', status: 'Connected', tenants: 20, lastSync: minutesAgo(6) },
]

export interface AIModelConfig {
  id: string
  feature: string
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'Azure OpenAI'
  model: string
  temperature: number
  maxTokens: number
  fallback: string
  enabled: boolean
}

export const aiModelConfigs: AIModelConfig[] = [
  { id: 'AI-1', feature: 'Restaurant Copilot (chat)', provider: 'Anthropic', model: 'claude-sonnet-4-5', temperature: 0.4, maxTokens: 2048, fallback: 'gpt-4o-mini', enabled: true },
  { id: 'AI-2', feature: 'Demand & sales forecasting', provider: 'Anthropic', model: 'claude-haiku-4-5', temperature: 0.1, maxTokens: 1024, fallback: 'gpt-4o-mini', enabled: true },
  { id: 'AI-3', feature: 'Menu engineering insights', provider: 'OpenAI', model: 'gpt-4o', temperature: 0.3, maxTokens: 1500, fallback: 'claude-haiku-4-5', enabled: true },
  { id: 'AI-4', feature: 'Social media content', provider: 'OpenAI', model: 'gpt-4o-mini', temperature: 0.8, maxTokens: 800, fallback: 'claude-haiku-4-5', enabled: true },
  { id: 'AI-5', feature: 'Review sentiment analysis', provider: 'Google', model: 'gemini-2.0-flash', temperature: 0.0, maxTokens: 512, fallback: 'claude-haiku-4-5', enabled: true },
  { id: 'AI-6', feature: 'Support ticket classification', provider: 'Anthropic', model: 'claude-haiku-4-5', temperature: 0.0, maxTokens: 512, fallback: 'gpt-4o-mini', enabled: true },
  { id: 'AI-7', feature: 'Fraud & anomaly detection', provider: 'Azure OpenAI', model: 'gpt-4o', temperature: 0.0, maxTokens: 1024, fallback: '—', enabled: false },
]

export interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  module: string
  enabled: boolean
  rollout: number
  plans: PlanName[]
}

export const featureFlags: FeatureFlag[] = [
  { id: 'F-1', key: 'ai_menu_engineering', name: 'AI menu engineering', description: 'Star / plough-horse / puzzle / dog matrix with AI suggestions.', module: 'Menu & Recipes', enabled: true, rollout: 100, plans: ['Pro', 'Enterprise'] },
  { id: 'F-2', key: 'kds_voice_alerts', name: 'KDS voice alerts', description: 'Spoken ticket alerts on kitchen screens.', module: 'Kitchen Display (KDS)', enabled: true, rollout: 25, plans: ['Pro', 'Pro', 'Enterprise'] },
  { id: 'F-3', key: 'whatsapp_ordering', name: 'WhatsApp ordering', description: 'Customers order through a WhatsApp bot.', module: 'Online Menu', enabled: true, rollout: 50, plans: ['Pro', 'Pro', 'Enterprise'] },
  { id: 'F-4', key: 'dynamic_pricing', name: 'Dynamic pricing (beta)', description: 'AI-driven happy-hour and surge pricing.', module: 'POS & Orders', enabled: false, rollout: 0, plans: ['Enterprise'] },
  { id: 'F-5', key: 'multi_currency', name: 'Multi-currency billing', description: 'Invoice tenants in PKR, AED or GBP.', module: 'Finance & Accounting', enabled: true, rollout: 100, plans: ['Free', 'Pro', 'Pro', 'Enterprise'] },
  { id: 'F-6', key: 'supplier_auto_po', name: 'Auto purchase orders', description: 'Generate POs when stock falls below par.', module: 'Suppliers & Procurement', enabled: true, rollout: 75, plans: ['Pro', 'Enterprise'] },
  { id: 'F-7', key: 'qr_table_payments', name: 'QR pay-at-table', description: 'Guests scan and pay at the table.', module: 'Tables & Reservations', enabled: false, rollout: 10, plans: ['Pro', 'Pro', 'Enterprise'] },
  { id: 'F-8', key: 'new_reports_ui', name: 'New BI reports UI', description: 'Redesigned reports & dashboard builder.', module: 'Reports & BI', enabled: true, rollout: 40, plans: ['Free', 'Pro', 'Pro', 'Enterprise'] },
]

export interface AIUsage {
  trend: { d: string; tokens: number; requests: number; cost: number }[]
  byTenant: { tenant: string; plan: PlanName; used: number; limit: number; cost: number }[]
  byFeature: { feature: string; share: number }[]
}

export const aiUsage: AIUsage = {
  trend: Array.from({ length: 14 }, (_, i) => ({
    d: `Oct ${i + 1}`.replace(/^Oct (\d)$/, 'Oct 0$1'),
    tokens: Math.round((2.1 + i * 0.12 + Math.sin(i / 2) * 0.4) * 1_000_000),
    requests: Math.round(9800 + i * 420 + Math.cos(i) * 900),
    cost: Math.round(38 + i * 2.6 + Math.sin(i / 2) * 6),
  })),
  byTenant: [
    { tenant: 'Urban Bites', plan: 'Pro', used: 3000, limit: 3000, cost: 61 },
    { tenant: 'Lahore Tikka Co.', plan: 'Pro', used: 3000, limit: 3000, cost: 58 },
    { tenant: 'Al Noor Shawarma', plan: 'Free', used: 500, limit: 500, cost: 12 },
    { tenant: 'Karachi Grill House', plan: 'Enterprise', used: 31200, limit: 50000, cost: 402 },
    { tenant: 'Golden Fork', plan: 'Enterprise', used: 22800, limit: 50000, cost: 296 },
    { tenant: 'Spice Route Kitchen', plan: 'Pro', used: 8100, limit: 10000, cost: 121 },
    { tenant: 'Mezze & Co.', plan: 'Pro', used: 6400, limit: 10000, cost: 97 },
    { tenant: 'La Piazza', plan: 'Pro', used: 2900, limit: 10000, cost: 41 },
    { tenant: 'The Burger Lab', plan: 'Pro', used: 2450, limit: 3000, cost: 44 },
    { tenant: 'Thames Curry House', plan: 'Pro', used: 1200, limit: 3000, cost: 22 },
  ],
  byFeature: [
    { feature: 'Copilot chat', share: 38 },
    { feature: 'Forecasting', share: 22 },
    { feature: 'Menu insights', share: 14 },
    { feature: 'Social content', share: 13 },
    { feature: 'Sentiment', share: 8 },
    { feature: 'Support triage', share: 5 },
  ],
}

export interface AIUsageLimits {
  starter: number
  growth: number
  pro: number
  enterprise: number
  hardStop: boolean
  alertAt: number
  monthlyBudget: number
}

export const aiUsageLimits: AIUsageLimits = { starter: 500, growth: 3000, pro: 10000, enterprise: 50000, hardStop: false, alertAt: 80, monthlyBudget: 2500 }

export const getGlobalSettings = () => request<GlobalSettings>('/admin/config/settings', globalSettings)
export const saveGlobalSettings = (s: GlobalSettings) => mutate<GlobalSettings>('/admin/config/settings', 'PUT', s)
export const getIntegrations = () => request<Integration[]>('/admin/config/integrations', integrations)
export const updateIntegration = (id: string, patch: Partial<Integration>) => mutate<Partial<Integration>>(`/admin/config/integrations/${id}`, 'PATCH', patch)
export const getAIModelConfigs = () => request<AIModelConfig[]>('/admin/config/ai-models', aiModelConfigs)
export const saveAIModelConfig = (c: AIModelConfig) => mutate<AIModelConfig>(`/admin/config/ai-models/${c.id}`, 'PUT', c)
export const getFeatureFlags = () => request<FeatureFlag[]>('/admin/config/feature-flags', featureFlags)
export const updateFeatureFlag = (id: string, patch: Partial<FeatureFlag>) => mutate<Partial<FeatureFlag>>(`/admin/config/feature-flags/${id}`, 'PATCH', patch)
export const getAIUsage = () => request<AIUsage>('/admin/config/ai-usage', aiUsage)
export const getAIUsageLimits = () => request<AIUsageLimits>('/admin/config/ai-limits', aiUsageLimits)
export const saveAIUsageLimits = (l: AIUsageLimits) => mutate<AIUsageLimits>('/admin/config/ai-limits', 'PUT', l)

/* ────────────────────────────────────────────────────────────────────────────
 * Support & monitoring
 * ──────────────────────────────────────────────────────────────────────────── */

export type TicketPriority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type TicketStatus = 'Open' | 'In Progress' | 'Pending' | 'Escalated' | 'Resolved' | 'Closed'

export interface Ticket {
  id: string
  subject: string
  tenant: string
  requester: string
  kind: 'Complaint' | 'Support request'
  category: 'Billing' | 'POS / Hardware' | 'Integrations' | 'Account access' | 'Feature request' | 'Bug' | 'Onboarding'
  priority: TicketPriority
  status: TicketStatus
  assignee: string
  channel: 'Email' | 'In-app' | 'WhatsApp' | 'Phone'
  aiCategory: string
  aiConfidence: number
  sentiment: 'Negative' | 'Neutral' | 'Positive'
  createdAt: string
  updatedAt: string
  slaHoursLeft: number
  description: string
}

type TicketSeed = [string, string, string, Ticket['kind'], Ticket['category'], TicketPriority, TicketStatus, string, Ticket['channel'], Ticket['sentiment'], number]
const ticketSeeds: TicketSeed[] = [
  ['POS not syncing orders to kitchen', 'Urban Bites', 'Hira Malik', 'Support request', 'POS / Hardware', 'Urgent', 'In Progress', 'Zain Abbas', 'Phone', 'Negative', 1],
  ['Charged twice for October subscription', 'Thames Curry House', 'Rahul Mehta', 'Complaint', 'Billing', 'High', 'Open', 'Fatima Noor', 'Email', 'Negative', 5],
  ['Talabat orders not appearing', 'Mezze & Co.', 'Omar Haddad', 'Support request', 'Integrations', 'Urgent', 'Escalated', 'Daniel Brooks', 'WhatsApp', 'Negative', 0],
  ['How do I add a new branch?', 'Karachi Grill House', 'Faisal Qureshi', 'Support request', 'Onboarding', 'Low', 'Resolved', 'Mariam Yousuf', 'In-app', 'Neutral', 20],
  ['Cannot log in — MFA code not received', 'The Burger Lab', 'Ali Raza', 'Support request', 'Account access', 'High', 'In Progress', 'Zain Abbas', 'Phone', 'Negative', 3],
  ['Request: split bills by seat', 'La Piazza', 'Marco Bellini', 'Support request', 'Feature request', 'Low', 'Pending', 'Mariam Yousuf', 'Email', 'Positive', 48],
  ['Receipt printer prints blank tickets', 'Spice Route Kitchen', 'Omar Siddiqui', 'Support request', 'POS / Hardware', 'Medium', 'Open', 'Zain Abbas', 'In-app', 'Neutral', 10],
  ['Account suspended without warning', 'Sushi Zen', 'Kenji Watanabe', 'Complaint', 'Billing', 'High', 'Escalated', 'Fatima Noor', 'Email', 'Negative', 2],
  ['Inventory counts reset after update', 'Lahore Tikka Co.', 'Kamran Butt', 'Complaint', 'Bug', 'High', 'In Progress', 'Rizwan Haider', 'In-app', 'Negative', 4],
  ['WhatsApp order notifications delayed', 'Desert Rose Dining', 'Layla Al Mansoori', 'Support request', 'Integrations', 'Medium', 'Open', 'Daniel Brooks', 'WhatsApp', 'Neutral', 12],
  ['Need VAT invoice in Arabic', 'Mezze & Co.', 'Omar Haddad', 'Support request', 'Billing', 'Low', 'Resolved', 'Fatima Noor', 'Email', 'Neutral', 30],
  ['Rider app crashes on Android 14', 'Al Noor Shawarma', 'Bilal Ahmed', 'Complaint', 'Bug', 'Medium', 'Open', 'Rizwan Haider', 'Phone', 'Negative', 8],
  ['Upload menu from Excel', 'Chai Shai Café', 'Sana Javed', 'Support request', 'Onboarding', 'Low', 'Closed', 'Mariam Yousuf', 'In-app', 'Positive', 40],
  ['Slow dashboard during dinner rush', 'Golden Fork', 'Emily Clarke', 'Complaint', 'Bug', 'Medium', 'In Progress', 'Rizwan Haider', 'Email', 'Negative', 9],
]

export const tickets: Ticket[] = ticketSeeds.map(([subject, tenant, requester, kind, category, priority, status, assignee, channel, sentiment, sla], i) => ({
  id: `TCK-${4820 - i}`,
  subject,
  tenant,
  requester,
  kind,
  category,
  priority,
  status,
  assignee,
  channel,
  aiCategory: category,
  aiConfidence: 82 + ((i * 7) % 17),
  sentiment,
  createdAt: minutesAgo(25 + i * 190),
  updatedAt: minutesAgo(5 + i * 60),
  slaHoursLeft: sla,
  description: `${requester} from ${tenant} reported: "${subject}". Reported via ${channel.toLowerCase()}.`,
}))

export interface ServiceStatus {
  id: string
  name: string
  group: 'Core' | 'Payments' | 'Messaging' | 'AI' | 'Integrations'
  status: 'Operational' | 'Degraded' | 'Down'
  uptime: number
  latency: number
  history: ('ok' | 'warn' | 'down')[]
}

const hist = (warn: number[], down: number[] = []): ServiceStatus['history'] =>
  Array.from({ length: 30 }, (_, i) => (down.includes(i) ? 'down' : warn.includes(i) ? 'warn' : 'ok'))

export const serviceStatuses: ServiceStatus[] = [
  { id: 'SV-1', name: 'Core API', group: 'Core', status: 'Operational', uptime: 99.99, latency: 142, history: hist([12]) },
  { id: 'SV-2', name: 'POS Sync', group: 'Core', status: 'Operational', uptime: 99.42, latency: 210, history: hist([4, 18, 27]) },
  { id: 'SV-3', name: 'Kitchen Display (WebSocket)', group: 'Core', status: 'Operational', uptime: 99.95, latency: 61, history: hist([]) },
  { id: 'SV-4', name: 'Database cluster', group: 'Core', status: 'Operational', uptime: 99.99, latency: 9, history: hist([]) },
  { id: 'SV-5', name: 'Payments — Stripe', group: 'Payments', status: 'Degraded', uptime: 99.71, latency: 2400, history: hist([28, 29]) },
  { id: 'SV-6', name: 'Payments — JazzCash / Easypaisa', group: 'Payments', status: 'Operational', uptime: 99.88, latency: 640, history: hist([9]) },
  { id: 'SV-7', name: 'Email (SendGrid)', group: 'Messaging', status: 'Operational', uptime: 99.98, latency: 320, history: hist([]) },
  { id: 'SV-8', name: 'WhatsApp Business', group: 'Messaging', status: 'Degraded', uptime: 98.9, latency: 1800, history: hist([22, 25, 29]) },
  { id: 'SV-9', name: 'AI Gateway', group: 'AI', status: 'Operational', uptime: 99.9, latency: 890, history: hist([15]) },
  { id: 'SV-10', name: 'Talabat connector', group: 'Integrations', status: 'Down', uptime: 97.2, latency: 0, history: hist([20, 21], [29]) },
  { id: 'SV-11', name: 'Foodpanda connector', group: 'Integrations', status: 'Operational', uptime: 99.6, latency: 410, history: hist([7]) },
  { id: 'SV-12', name: 'Reporting / BI workers', group: 'Core', status: 'Operational', uptime: 99.8, latency: 1200, history: hist([3, 16]) },
]

export const latencySeries = Array.from({ length: 24 }, (_, i) => ({
  h: `${String(i).padStart(2, '0')}:00`,
  p50: Math.round(90 + Math.sin(i / 3) * 15 + (i >= 19 && i <= 22 ? 30 : 0)),
  p95: Math.round(170 + Math.sin(i / 3) * 30 + (i >= 19 && i <= 22 ? 90 : 0)),
  errors: Number((0.12 + (i >= 20 && i <= 21 ? 0.5 : 0) + (i % 5) * 0.02).toFixed(2)),
}))

export interface SystemError {
  id: string
  source: string
  type: 'Integration failure' | 'Application error' | 'Payment failure' | 'Webhook failure' | 'Job failure'
  message: string
  tenant: string
  count: number
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'Open' | 'Resolved' | 'In Progress'
  lastSeen: string
}

export const systemErrors: SystemError[] = [
  { id: 'ER-1', source: 'Talabat connector', type: 'Integration failure', message: '401 Unauthorized — partner token expired', tenant: '4 tenants', count: 382, severity: 'Critical', status: 'In Progress', lastSeen: minutesAgo(1) },
  { id: 'ER-2', source: 'Stripe', type: 'Payment failure', message: 'Timeout after 10000ms on /v1/payment_intents', tenant: '9 tenants', count: 57, severity: 'High', status: 'Open', lastSeen: minutesAgo(3) },
  { id: 'ER-3', source: 'WhatsApp Business', type: 'Webhook failure', message: 'Template order_ready_v3 rejected (code 132001)', tenant: '12 tenants', count: 941, severity: 'Medium', status: 'Open', lastSeen: minutesAgo(9) },
  { id: 'ER-4', source: 'inventory-service', type: 'Application error', message: 'NullReferenceException in StockLedger.Recalculate()', tenant: 'Lahore Tikka Co.', count: 14, severity: 'High', status: 'In Progress', lastSeen: minutesAgo(40) },
  { id: 'ER-5', source: 'report-worker', type: 'Job failure', message: 'Monthly P&L export exceeded 15 min timeout', tenant: 'Golden Fork', count: 3, severity: 'Medium', status: 'Open', lastSeen: minutesAgo(120) },
  { id: 'ER-6', source: 'pos-sync', type: 'Application error', message: 'Conflict resolving offline order #UB-88412', tenant: 'Urban Bites', count: 26, severity: 'High', status: 'In Progress', lastSeen: minutesAgo(18) },
  { id: 'ER-7', source: 'QuickBooks Online', type: 'Integration failure', message: 'Rate limit (429) on journal sync', tenant: 'Desert Rose Dining', count: 8, severity: 'Low', status: 'Resolved', lastSeen: minutesAgo(600) },
  { id: 'ER-8', source: 'Twilio SMS', type: 'Integration failure', message: 'Undeliverable to +92 network (code 30008)', tenant: 'The Burger Lab', count: 19, severity: 'Medium', status: 'Resolved', lastSeen: minutesAgo(380) },
]

export interface Incident {
  id: string
  title: string
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3'
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved'
  commander: string
  affected: string[]
  escalationLevel: 1 | 2 | 3
  startedAt: string
  resolvedAt?: string
  timeline: { at: string; note: string }[]
}

export const incidents: Incident[] = [
  {
    id: 'INC-118',
    title: 'Talabat orders not reaching UAE restaurants',
    severity: 'SEV-1',
    status: 'Identified',
    commander: 'Daniel Brooks',
    affected: ['Talabat connector', 'Mezze & Co.', 'Desert Rose Dining', 'Sushi Zen'],
    escalationLevel: 2,
    startedAt: minutesAgo(130),
    timeline: [
      { at: minutesAgo(130), note: 'Alert: Talabat webhook 401 error rate > 50%.' },
      { at: minutesAgo(118), note: 'Incident declared, Daniel Brooks is incident commander.' },
      { at: minutesAgo(95), note: 'Root cause: partner OAuth token expired; rotation job failed silently.' },
      { at: minutesAgo(40), note: 'Escalated to Talabat partner support (L2).' },
    ],
  },
  {
    id: 'INC-117',
    title: 'Stripe EU payment latency',
    severity: 'SEV-2',
    status: 'Monitoring',
    commander: 'Rizwan Haider',
    affected: ['Payments — Stripe', 'La Piazza', 'Golden Fork', 'Thames Curry House'],
    escalationLevel: 1,
    startedAt: minutesAgo(48),
    timeline: [
      { at: minutesAgo(48), note: 'p95 latency on payment intents > 2s.' },
      { at: minutesAgo(30), note: 'Stripe status page confirms elevated latency in EU.' },
      { at: minutesAgo(12), note: 'Retries with backoff enabled; monitoring.' },
    ],
  },
  {
    id: 'INC-116',
    title: 'WhatsApp template rejected by Meta',
    severity: 'SEV-3',
    status: 'Investigating',
    commander: 'Mariam Yousuf',
    affected: ['WhatsApp Business'],
    escalationLevel: 1,
    startedAt: minutesAgo(190),
    timeline: [{ at: minutesAgo(190), note: 'Order-ready notifications falling back to SMS.' }],
  },
  {
    id: 'INC-115',
    title: 'POS sync backlog during Friday dinner rush',
    severity: 'SEV-2',
    status: 'Resolved',
    commander: 'Rizwan Haider',
    affected: ['POS Sync', 'Urban Bites', 'Lahore Tikka Co.'],
    escalationLevel: 1,
    startedAt: minutesAgo(60 * 24 * 6),
    resolvedAt: minutesAgo(60 * 24 * 6 - 75),
    timeline: [
      { at: minutesAgo(60 * 24 * 6), note: 'Queue depth > 20k messages.' },
      { at: minutesAgo(60 * 24 * 6 - 75), note: 'Workers autoscaled 4 → 12; backlog cleared.' },
    ],
  },
]

export const getTickets = () => request<Ticket[]>('/admin/support/tickets', tickets)
export const updateTicket = (id: string, patch: Partial<Ticket>) => mutate<Partial<Ticket>>(`/admin/support/tickets/${id}`, 'PATCH', patch)
export const getServiceStatuses = () => request<ServiceStatus[]>('/admin/monitoring/services', serviceStatuses)
export const getLatencySeries = () => request<typeof latencySeries>('/admin/monitoring/latency', latencySeries)
export const getSystemErrors = () => request<SystemError[]>('/admin/monitoring/errors', systemErrors)
export const updateSystemError = (id: string, patch: Partial<SystemError>) => mutate<Partial<SystemError>>(`/admin/monitoring/errors/${id}`, 'PATCH', patch)
export const getIncidents = () => request<Incident[]>('/admin/incidents', incidents)
export const saveIncident = (inc: Incident) => mutate<Incident>(`/admin/incidents/${inc.id}`, 'PUT', inc)

/* ────────────────────────────────────────────────────────────────────────────
 * Restaurant Admin Setup (restaurant side of onboarding)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SetupRole {
  id: string
  name: string
  permissions: string[]
  members: number
}

export const setupPermissionCatalog = [
  'Take orders',
  'Apply discounts',
  'Void / refund',
  'Manage menu',
  'Manage inventory',
  'View reports',
  'Manage staff',
  'Close day / cash-up',
]

export const defaultSetupRoles: SetupRole[] = [
  { id: 'SR-1', name: 'Branch Manager', permissions: setupPermissionCatalog, members: 3 },
  { id: 'SR-2', name: 'Cashier', permissions: ['Take orders', 'Apply discounts', 'Close day / cash-up'], members: 6 },
  { id: 'SR-3', name: 'Waiter', permissions: ['Take orders'], members: 14 },
  { id: 'SR-4', name: 'Head Chef', permissions: ['Manage menu', 'Manage inventory', 'View reports'], members: 3 },
  { id: 'SR-5', name: 'Kitchen Staff', permissions: [], members: 11 },
  { id: 'SR-6', name: 'Rider', permissions: [], members: 8 },
]

export const getSetupRoles = () => request<SetupRole[]>('/setup/roles', defaultSetupRoles)
export const saveSetup = (step: string, payload: unknown) => mutate<unknown>(`/setup/${step}`, 'PUT', payload)
export const goLive = () => mutate<{ live: boolean }>('/setup/go-live', 'POST', { live: true })
