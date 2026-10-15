import { Armchair, BarChart3, Bike, Bot, ChefHat, ClipboardCheck, ConciergeBell, Crown, Globe, Heart, LayoutDashboard, Megaphone, Package, ShoppingCart, Smartphone, Store, Truck, Users, UtensilsCrossed, Wallet } from 'lucide-react'
import type { NavSection } from '@/shared/navigation'

/** Restaurant Operations — Free tier is the MVP workflows; the rest is Pro / Enterprise. */
export const restaurantNav: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/app', icon: LayoutDashboard, feature: 'dashboard' },
      { label: 'Plans & Upgrade', to: '/app/plans', icon: Crown },
      { label: 'AI & Automation', to: '/app/ai', icon: Bot, feature: 'ai' },
    ],
  },
  {
    title: 'Live Operations',
    items: [
      { label: 'Main Counter', to: '/counter', icon: ConciergeBell, feature: 'counter' },
      { label: 'Waiter App', to: '/waiter', icon: Smartphone, feature: 'waiterApp' },
      { label: 'Kitchen Portal', to: '/kitchen', icon: ChefHat, feature: 'kitchen' },
      { label: 'Rider App', to: '/rider', icon: Bike, feature: 'riderApp' },
      { label: 'Customer App', to: '/order', icon: Store, feature: 'customerApp', external: true },
    ],
  },
  {
    title: 'Front of House',
    items: [
      { label: 'Orders & POS', to: '/app/pos', icon: ShoppingCart, feature: 'pos' },
      { label: 'Tables & Reservations', to: '/app/tables', icon: Armchair, feature: 'tables' },
      { label: 'Delivery & Takeaway', to: '/app/delivery', icon: Truck, feature: 'delivery' },
      { label: 'Customers & Loyalty', to: '/app/customers', icon: Heart, feature: 'customers' },
    ],
  },
  {
    title: 'Back of House',
    items: [
      { label: 'Menu & Recipes', to: '/app/menu', icon: UtensilsCrossed, feature: 'menu' },
      { label: 'Inventory', to: '/app/inventory', icon: Package, feature: 'inventory' },
      { label: 'Suppliers & Procurement', to: '/app/suppliers', icon: Truck, feature: 'suppliers' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Online Menu', to: '/app/online-menu', icon: Globe, feature: 'onlineMenu' },
      { label: 'Social Media', to: '/app/social', icon: Megaphone, feature: 'social' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Employees & HR', to: '/app/employees', icon: Users, feature: 'employees' },
      { label: 'Finance & Accounting', to: '/app/finance', icon: Wallet, feature: 'finance' },
      { label: 'Quality & Compliance', to: '/app/compliance', icon: ClipboardCheck, feature: 'compliance' },
      { label: 'Reports & BI', to: '/app/reports', icon: BarChart3, feature: 'reports' },
    ],
  },
]
