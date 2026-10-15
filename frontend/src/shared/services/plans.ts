/**
 * Subscription tiers and what each one unlocks.
 *
 * Free is the MVP: the dine-in and delivery workflows end to end
 * (waiter → counter → kitchen → rider / customer app, voice agent included).
 * Everything else is sold as Pro or Enterprise.
 */

export type Tier = 'Free' | 'Pro' | 'Enterprise'
export const TIERS: Tier[] = ['Free', 'Pro', 'Enterprise']

export const tierRank = (t: Tier) => TIERS.indexOf(t)
export const hasTier = (current: Tier, needed: Tier) => tierRank(current) >= tierRank(needed)

export type Feature =
  // Free — MVP workflows
  | 'dashboard'
  | 'pos'
  | 'tables'
  | 'menu'
  | 'kitchen'
  | 'kitchenVoice'
  | 'counter'
  | 'waiterApp'
  | 'customerApp'
  | 'riderApp'
  | 'verifyCall'
  | 'delivery'
  // Pro
  | 'inventory'
  | 'stockAlerts'
  | 'smartStock'
  | 'suppliers'
  | 'customers'
  | 'onlineMenu'
  | 'social'
  | 'employees'
  | 'reports'
  | 'aggregators'
  // Enterprise
  | 'finance'
  | 'compliance'
  | 'ai'
  | 'copilot'
  | 'multiBranch'

export interface FeatureInfo {
  label: string
  tier: Tier
  description: string
}

export const features: Record<Feature, FeatureInfo> = {
  dashboard: { label: "Today's dashboard", tier: 'Free', description: 'Live sales, orders and tables for today' },
  pos: { label: 'Orders & POS', tier: 'Free', description: 'Order taking, billing, tips, Cash & Easypaisa' },
  tables: { label: 'Tables & reservations', tier: 'Free', description: 'Table status, reservations and walk-ins' },
  menu: { label: 'Menu', tier: 'Free', description: 'Items, prices, variants and availability' },
  kitchen: { label: 'Kitchen display (KDS)', tier: 'Free', description: 'Kitchen order queue with ready alerts' },
  kitchenVoice: { label: 'Kitchen voice agent', tier: 'Free', description: 'Announces orders in Urdu, chef confirms by voice' },
  counter: { label: 'Main counter', tier: 'Free', description: 'Incoming orders, packing, billing and table release' },
  waiterApp: { label: 'Waiter app', tier: 'Free', description: 'Seat guests, take orders, pickup alerts, serve' },
  customerApp: { label: 'Customer ordering app', tier: 'Free', description: 'Browse menu, order and track delivery' },
  riderApp: { label: 'Rider app', tier: 'Free', description: 'Pickup scan, navigation, cash / Easypaisa collection' },
  verifyCall: { label: 'Order verification call', tier: 'Free', description: 'Voice agent calls the customer to confirm the order' },
  delivery: { label: 'Delivery & takeaway', tier: 'Free', description: 'Own riders and delivery orders' },

  inventory: { label: 'Inventory', tier: 'Pro', description: 'Stock levels, movements and wastage' },
  stockAlerts: { label: 'Stock alerts', tier: 'Pro', description: 'Recipe-based auto deduction and run-out alerts' },
  smartStock: { label: 'Smart stock entry', tier: 'Pro', description: 'Add stock by voice, invoice photo or PO receiving' },
  suppliers: { label: 'Suppliers & procurement', tier: 'Pro', description: 'Purchase orders and supplier management' },
  customers: { label: 'Customers & loyalty', tier: 'Pro', description: 'CRM, points and rewards' },
  onlineMenu: { label: 'Online menu & QR', tier: 'Pro', description: 'Branded web menu and QR ordering' },
  social: { label: 'Social media', tier: 'Pro', description: 'Post scheduling and campaigns' },
  employees: { label: 'Employees & HR', tier: 'Pro', description: 'Staff, shifts, attendance and payroll' },
  reports: { label: 'Reports & BI', tier: 'Pro', description: 'Sales, menu and staff analytics' },
  aggregators: { label: 'Delivery integrations', tier: 'Pro', description: 'Foodpanda, Careem and other marketplaces' },

  finance: { label: 'Finance & accounting', tier: 'Enterprise', description: 'P&L, expenses and tax' },
  compliance: { label: 'Quality & compliance', tier: 'Enterprise', description: 'Audits, food safety and licences' },
  ai: { label: 'AI & automation', tier: 'Enterprise', description: 'Forecasting, pricing and automations' },
  copilot: { label: 'AI Copilot', tier: 'Enterprise', description: 'Ask questions about your restaurant' },
  multiBranch: { label: 'Multi-branch', tier: 'Enterprise', description: 'Manage several branches from one account' },
}

export const featureTier = (f: Feature) => features[f].tier
export const canUse = (tier: Tier, f: Feature) => hasTier(tier, features[f].tier)

/** Tier that includes each module of the platform module catalog (Super Admin side). */
export const moduleTier: Record<string, Tier> = {
  'POS & Orders': 'Free',
  'Tables & Reservations': 'Free',
  'Kitchen Display (KDS)': 'Free',
  'Menu & Recipes': 'Free',
  'Delivery & Takeaway': 'Free',
  Inventory: 'Pro',
  'Suppliers & Procurement': 'Pro',
  'Customers & Loyalty': 'Pro',
  'Online Menu': 'Pro',
  'Social Media': 'Pro',
  'Employees & HR': 'Pro',
  'Reports & BI': 'Pro',
  'Finance & Accounting': 'Enterprise',
  'Quality & Compliance': 'Enterprise',
  'AI & Automation': 'Enterprise',
}

export interface TierInfo {
  tier: Tier
  tagline: string
  monthly: number
  yearly: number
  maxBranches: number
  maxUsers: number
  voiceMinutes: number
}

export const tierInfo: Record<Tier, TierInfo> = {
  Free: { tier: 'Free', tagline: 'Run dine-in and delivery end to end', monthly: 0, yearly: 0, maxBranches: 1, maxUsers: 15, voiceMinutes: 300 },
  Pro: { tier: 'Pro', tagline: 'Back office, stock and growth tools', monthly: 299, yearly: 2990, maxBranches: 5, maxUsers: 100, voiceMinutes: 3000 },
  Enterprise: { tier: 'Enterprise', tagline: 'Chains with AI, finance and compliance', monthly: 1490, yearly: 14900, maxBranches: 999, maxUsers: 9999, voiceMinutes: 20000 },
}
