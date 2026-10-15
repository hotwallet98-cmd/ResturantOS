/**
 * Restaurant operations services: POS, KDS, menu, tables, inventory,
 * delivery and HR. Every function goes through `request()` / `mutate()`
 * so the mock data below can be swapped for a real backend later.
 */
import type { AIInsight } from '@/shared/components/ui'
import { daysFromNow, minutesAgo } from '@/shared/lib/format'
import { mutate, request } from './client'

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const BRANCHES = ['Downtown', 'Mall Road', 'Airport'] as const
export type Branch = (typeof BRANCHES)[number]

export type Station = 'Grill' | 'Tandoor' | 'Wok' | 'Cold' | 'Drinks'
export const STATIONS: Station[] = ['Grill', 'Tandoor', 'Wok', 'Cold', 'Drinks']

export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery'
export type OrderChannel = 'POS' | 'Website' | 'Mobile App' | 'Foodpanda' | 'Careem' | 'Uber Eats' | 'Deliveroo'
export type PaymentMethod = 'Cash' | 'Card' | 'Wallet'

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export const MENU_CATEGORIES = ['Starters', 'BBQ & Grill', 'Karahi & Curries', 'Rice & Biryani', 'Breads', 'Burgers & Wraps', 'Pasta & Continental', 'Desserts', 'Beverages'] as const
export type MenuCategory = (typeof MENU_CATEGORIES)[number]

export type DayPart = 'Breakfast' | 'Lunch' | 'Hi-Tea' | 'Dinner' | 'Late Night'
export const DAY_PARTS: DayPart[] = ['Breakfast', 'Lunch', 'Hi-Tea', 'Dinner', 'Late Night']

export interface PriceOption {
  name: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  emoji: string
  category: MenuCategory
  description: string
  price: number
  cost: number
  station: Station
  prepMins: number
  veg: boolean
  spicy: 0 | 1 | 2 | 3
  available: boolean
  variants: PriceOption[]
  addons: PriceOption[]
  dayParts: DayPart[]
  /** Units sold in the last 7 days */
  soldWeek: number
  rating: number
}

const m = (
  id: string,
  name: string,
  emoji: string,
  category: MenuCategory,
  price: number,
  cost: number,
  station: Station,
  prepMins: number,
  soldWeek: number,
  extra: Partial<MenuItem> = {},
): MenuItem => ({
  id,
  name,
  emoji,
  category,
  price,
  cost,
  station,
  prepMins,
  soldWeek,
  description: '',
  veg: false,
  spicy: 1,
  available: true,
  variants: [],
  addons: [],
  dayParts: ['Lunch', 'Dinner'],
  rating: 4.5,
  ...extra,
})

export const menuItems: MenuItem[] = [
  m('mi-01', 'Chicken Tikka Boti', '🍢', 'Starters', 8.5, 2.9, 'Grill', 14, 212, { description: 'Char-grilled boneless chicken in house tikka marinade', spicy: 2, rating: 4.7 }),
  m('mi-02', 'Paneer Tikka', '🧀', 'Starters', 7.9, 2.4, 'Tandoor', 12, 98, { veg: true, description: 'Cottage cheese, peppers & onion, tandoor roasted', addons: [{ name: 'Extra mint chutney', price: 0.5 }], rating: 4.4 }),
  m('mi-03', 'Chicken Wings (8 pc)', '🍗', 'Starters', 7.5, 2.6, 'Wok', 10, 154, { variants: [{ name: 'Buffalo', price: 0 }, { name: 'Honey Garlic', price: 0 }, { name: 'Peri Peri', price: 0.5 }], dayParts: ['Lunch', 'Hi-Tea', 'Dinner', 'Late Night'] }),
  m('mi-04', 'Dahi Puri Chaat', '🥣', 'Starters', 5.5, 1.2, 'Cold', 6, 76, { veg: true, spicy: 1, dayParts: ['Hi-Tea', 'Dinner'], rating: 4.3 }),
  m('mi-05', 'Seekh Kebab (4 pc)', '🥙', 'BBQ & Grill', 9.9, 3.4, 'Grill', 15, 241, { description: 'Minced beef skewers with green chilli & coriander', spicy: 2, variants: [{ name: 'Beef', price: 0 }, { name: 'Chicken', price: -0.5 }, { name: 'Mutton', price: 1.5 }], rating: 4.8 }),
  m('mi-06', 'Malai Boti', '🍖', 'BBQ & Grill', 10.5, 3.6, 'Grill', 16, 167, { spicy: 0, description: 'Creamy cardamom-marinated chicken cubes' }),
  m('mi-07', 'Lamb Chops (4 pc)', '🥩', 'BBQ & Grill', 18.9, 8.4, 'Grill', 20, 64, { description: 'Marinated in raw papaya & garam masala', rating: 4.9 }),
  m('mi-08', 'Tandoori Chicken (Half)', '🍗', 'BBQ & Grill', 11.5, 3.9, 'Tandoor', 22, 133, { variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 8 }] }),
  m('mi-09', 'Chicken Karahi', '🍲', 'Karahi & Curries', 16.5, 5.6, 'Wok', 20, 286, { description: 'Wok-cooked with tomatoes, ginger & green chillies', spicy: 2, variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 12 }], addons: [{ name: 'Extra butter', price: 1 }, { name: 'Green chillies', price: 0 }], rating: 4.8 }),
  m('mi-10', 'Mutton Karahi', '🥘', 'Karahi & Curries', 22.0, 9.8, 'Wok', 28, 118, { spicy: 2, variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 16 }], rating: 4.7 }),
  m('mi-11', 'Butter Chicken', '🍛', 'Karahi & Curries', 14.5, 4.4, 'Wok', 16, 198, { spicy: 0, addons: [{ name: 'Extra cream', price: 1 }] }),
  m('mi-12', 'Daal Makhani', '🫘', 'Karahi & Curries', 9.5, 1.8, 'Wok', 10, 87, { veg: true, spicy: 0, rating: 4.4 }),
  m('mi-13', 'Palak Paneer', '🥬', 'Karahi & Curries', 10.5, 2.6, 'Wok', 12, 41, { veg: true, spicy: 1, rating: 4.1, soldWeek: 41 }),
  m('mi-14', 'Mutton Biryani', '🍚', 'Rice & Biryani', 13.9, 5.2, 'Wok', 8, 264, { description: 'Dum-cooked basmati with tender mutton & saffron', spicy: 2, addons: [{ name: 'Raita', price: 1 }, { name: 'Extra boti', price: 3.5 }], rating: 4.9 }),
  m('mi-15', 'Chicken Biryani', '🍛', 'Rice & Biryani', 11.5, 3.3, 'Wok', 8, 302, { spicy: 2, addons: [{ name: 'Raita', price: 1 }, { name: 'Boiled egg', price: 0.8 }] }),
  m('mi-16', 'Vegetable Pulao', '🍚', 'Rice & Biryani', 8.0, 1.6, 'Wok', 8, 34, { veg: true, spicy: 0, rating: 4.0 }),
  m('mi-17', 'Garlic Naan', '🫓', 'Breads', 2.5, 0.35, 'Tandoor', 4, 512, { veg: true, spicy: 0, dayParts: ['Lunch', 'Dinner', 'Late Night'], rating: 4.8 }),
  m('mi-18', 'Butter Naan', '🫓', 'Breads', 2.0, 0.3, 'Tandoor', 4, 438, { veg: true, spicy: 0 }),
  m('mi-19', 'Roghni Naan', '🫓', 'Breads', 2.5, 0.4, 'Tandoor', 5, 176, { veg: true, spicy: 0 }),
  m('mi-20', 'Zinger Burger', '🍔', 'Burgers & Wraps', 8.9, 2.8, 'Grill', 9, 248, { addons: [{ name: 'Cheese slice', price: 0.8 }, { name: 'Jalapeños', price: 0.5 }, { name: 'Make it a meal', price: 3 }], dayParts: ['Lunch', 'Hi-Tea', 'Dinner', 'Late Night'], rating: 4.6 }),
  m('mi-21', 'Smash Beef Burger', '🍔', 'Burgers & Wraps', 10.9, 3.9, 'Grill', 10, 121, { addons: [{ name: 'Extra patty', price: 3 }, { name: 'Cheese slice', price: 0.8 }] }),
  m('mi-22', 'Chicken Shawarma Wrap', '🌯', 'Burgers & Wraps', 6.9, 1.9, 'Grill', 7, 187, { dayParts: ['Lunch', 'Hi-Tea', 'Late Night'] }),
  m('mi-23', 'Alfredo Pasta', '🍝', 'Pasta & Continental', 12.5, 3.4, 'Wok', 13, 142, { spicy: 0, variants: [{ name: 'Chicken', price: 0 }, { name: 'Mushroom', price: -1 }, { name: 'Prawns', price: 3 }], rating: 4.5 }),
  m('mi-24', 'Grilled Chicken Steak', '🍽️', 'Pasta & Continental', 15.9, 5.1, 'Grill', 18, 73, { spicy: 0, variants: [{ name: 'Mushroom sauce', price: 0 }, { name: 'Pepper sauce', price: 0 }] }),
  m('mi-25', 'Caesar Salad', '🥗', 'Pasta & Continental', 8.5, 2.2, 'Cold', 6, 52, { spicy: 0, addons: [{ name: 'Grilled chicken', price: 2.5 }] }),
  m('mi-26', 'Kheer', '🍮', 'Desserts', 4.5, 0.9, 'Cold', 2, 168, { veg: true, spicy: 0, rating: 4.7 }),
  m('mi-27', 'Gulab Jamun (2 pc)', '🟤', 'Desserts', 3.9, 0.7, 'Cold', 2, 143, { veg: true, spicy: 0 }),
  m('mi-28', 'Molten Lava Cake', '🍫', 'Desserts', 6.5, 1.8, 'Cold', 8, 61, { veg: true, spicy: 0, addons: [{ name: 'Vanilla scoop', price: 1.5 }] }),
  m('mi-29', 'Mint Margarita', '🍹', 'Beverages', 3.9, 0.6, 'Drinks', 3, 356, { veg: true, spicy: 0, dayParts: DAY_PARTS, rating: 4.8 }),
  m('mi-30', 'Mango Lassi', '🥭', 'Beverages', 4.2, 0.9, 'Drinks', 3, 198, { veg: true, spicy: 0, dayParts: DAY_PARTS }),
  m('mi-31', 'Doodh Patti Chai', '☕', 'Beverages', 2.2, 0.3, 'Drinks', 4, 221, { veg: true, spicy: 0, dayParts: ['Breakfast', 'Hi-Tea', 'Late Night'], variants: [{ name: 'Regular', price: 0 }, { name: 'Karak', price: 0.3 }] }),
  m('mi-32', 'Soft Drink', '🥤', 'Beverages', 1.8, 0.5, 'Drinks', 1, 412, { veg: true, spicy: 0, dayParts: DAY_PARTS, variants: [{ name: 'Can', price: 0 }, { name: '1.5L', price: 1.7 }] }),
  m('mi-33', 'Fresh Lime Soda', '🍋', 'Beverages', 3.2, 0.4, 'Drinks', 2, 117, { veg: true, spicy: 0, available: false }),
]

export interface RecipeIngredient {
  ingredient: string
  qty: number
  unit: string
  cost: number
}

export interface Recipe {
  itemId: string
  yield: string
  steps: string[]
  ingredients: RecipeIngredient[]
}

export const recipes: Recipe[] = [
  {
    itemId: 'mi-09',
    yield: '1 half karahi (serves 2)',
    steps: ['Heat oil, sear chicken on high flame', 'Add tomatoes, ginger, garlic; cover 8 min', 'Bhuno until oil separates', 'Finish with green chillies, ginger julienne, coriander'],
    ingredients: [
      { ingredient: 'Chicken (bone-in)', qty: 0.5, unit: 'kg', cost: 2.9 },
      { ingredient: 'Tomatoes', qty: 0.3, unit: 'kg', cost: 0.45 },
      { ingredient: 'Cooking Oil', qty: 0.08, unit: 'L', cost: 0.22 },
      { ingredient: 'Ginger & Garlic paste', qty: 0.04, unit: 'kg', cost: 0.18 },
      { ingredient: 'Green Chillies', qty: 0.02, unit: 'kg', cost: 0.08 },
      { ingredient: 'Karahi Masala', qty: 0.025, unit: 'kg', cost: 0.35 },
      { ingredient: 'Butter', qty: 0.03, unit: 'kg', cost: 0.42 },
      { ingredient: 'Coriander', qty: 0.01, unit: 'kg', cost: 0.05 },
    ],
  },
  {
    itemId: 'mi-14',
    yield: '1 plate',
    steps: ['Marinate mutton in yoghurt & spices 4h', 'Par-boil basmati with whole spices', 'Layer meat and rice, add saffron milk', 'Seal and dum for 25 min'],
    ingredients: [
      { ingredient: 'Mutton', qty: 0.18, unit: 'kg', cost: 3.1 },
      { ingredient: 'Basmati Rice', qty: 0.15, unit: 'kg', cost: 0.42 },
      { ingredient: 'Yoghurt', qty: 0.05, unit: 'kg', cost: 0.12 },
      { ingredient: 'Onions', qty: 0.08, unit: 'kg', cost: 0.09 },
      { ingredient: 'Biryani Masala', qty: 0.02, unit: 'kg', cost: 0.3 },
      { ingredient: 'Saffron', qty: 0.1, unit: 'g', cost: 0.6 },
      { ingredient: 'Ghee', qty: 0.03, unit: 'kg', cost: 0.38 },
    ],
  },
  {
    itemId: 'mi-05',
    yield: '4 skewers',
    steps: ['Mince beef with fat (80/20)', 'Mix spices, onion, chilli; rest 1h', 'Shape onto skewers', 'Grill on charcoal 8–10 min'],
    ingredients: [
      { ingredient: 'Beef Mince', qty: 0.25, unit: 'kg', cost: 2.4 },
      { ingredient: 'Onions', qty: 0.05, unit: 'kg', cost: 0.06 },
      { ingredient: 'Green Chillies', qty: 0.015, unit: 'kg', cost: 0.06 },
      { ingredient: 'Seekh Masala', qty: 0.02, unit: 'kg', cost: 0.28 },
      { ingredient: 'Charcoal', qty: 0.3, unit: 'kg', cost: 0.6 },
    ],
  },
  {
    itemId: 'mi-20',
    yield: '1 burger',
    steps: ['Marinate fillet overnight', 'Double-dip in spiced flour', 'Fry at 175°C for 6 min', 'Assemble: bun, mayo, lettuce, fillet'],
    ingredients: [
      { ingredient: 'Chicken Fillet', qty: 0.15, unit: 'kg', cost: 1.35 },
      { ingredient: 'Burger Bun', qty: 1, unit: 'pc', cost: 0.35 },
      { ingredient: 'Breading Flour', qty: 0.06, unit: 'kg', cost: 0.12 },
      { ingredient: 'Cooking Oil', qty: 0.05, unit: 'L', cost: 0.14 },
      { ingredient: 'Mayonnaise', qty: 0.03, unit: 'kg', cost: 0.15 },
      { ingredient: 'Lettuce', qty: 0.02, unit: 'kg', cost: 0.06 },
    ],
  },
  {
    itemId: 'mi-23',
    yield: '1 plate',
    steps: ['Boil fettuccine al dente', 'Sauté chicken & garlic in butter', 'Add cream & parmesan, reduce', 'Toss pasta, garnish parsley'],
    ingredients: [
      { ingredient: 'Fettuccine', qty: 0.12, unit: 'kg', cost: 0.4 },
      { ingredient: 'Chicken Fillet', qty: 0.1, unit: 'kg', cost: 0.9 },
      { ingredient: 'Cooking Cream', qty: 0.12, unit: 'L', cost: 0.95 },
      { ingredient: 'Parmesan', qty: 0.03, unit: 'kg', cost: 0.82 },
      { ingredient: 'Butter', qty: 0.02, unit: 'kg', cost: 0.28 },
    ],
  },
  {
    itemId: 'mi-17',
    yield: '1 naan',
    steps: ['Proof dough 2h', 'Stretch, brush garlic butter', 'Slap onto tandoor wall 90s'],
    ingredients: [
      { ingredient: 'Flour (Maida)', qty: 0.1, unit: 'kg', cost: 0.08 },
      { ingredient: 'Garlic', qty: 0.01, unit: 'kg', cost: 0.05 },
      { ingredient: 'Butter', qty: 0.01, unit: 'kg', cost: 0.14 },
      { ingredient: 'Yoghurt', qty: 0.02, unit: 'kg', cost: 0.05 },
    ],
  },
]

export interface Combo {
  id: string
  name: string
  emoji: string
  items: string[]
  price: number
  originalPrice: number
  active: boolean
  soldWeek: number
}

export const combos: Combo[] = [
  { id: 'cb-1', name: 'Family Karahi Feast', emoji: '👨‍👩‍👧', items: ['Chicken Karahi (Full)', '4 Garlic Naan', '1.5L Soft Drink', 'Kheer x2'], price: 39.9, originalPrice: 47.0, active: true, soldWeek: 58 },
  { id: 'cb-2', name: 'Zinger Meal Deal', emoji: '🍔', items: ['Zinger Burger', 'Fries', 'Soft Drink'], price: 10.9, originalPrice: 12.7, active: true, soldWeek: 141 },
  { id: 'cb-3', name: 'BBQ Platter for 2', emoji: '🔥', items: ['Seekh Kebab', 'Malai Boti', 'Tikka Boti', '2 Naan', 'Mint Margarita x2'], price: 32.5, originalPrice: 38.6, active: true, soldWeek: 44 },
  { id: 'cb-4', name: 'Biryani Lunch Box', emoji: '🍱', items: ['Chicken Biryani', 'Raita', 'Soft Drink'], price: 12.5, originalPrice: 14.3, active: true, soldWeek: 96 },
  { id: 'cb-5', name: 'Hi-Tea Chai Set', emoji: '☕', items: ['Doodh Patti x2', 'Dahi Puri', 'Wings (4 pc)'], price: 11.9, originalPrice: 14.0, active: false, soldWeek: 0 },
]

export interface Promotion {
  id: string
  name: string
  type: 'Percentage' | 'Flat' | 'BOGO' | 'Happy Hour'
  value: number
  code: string
  channel: 'All' | 'Dine-in' | 'Online' | 'Delivery'
  startsAt: string
  endsAt: string
  status: 'Active' | 'Scheduled' | 'Expired' | 'Draft'
  redemptions: number
}

export const promotions: Promotion[] = [
  { id: 'pr-1', name: 'Weekday Lunch 15%', type: 'Percentage', value: 15, code: 'LUNCH15', channel: 'Dine-in', startsAt: daysFromNow(-20), endsAt: daysFromNow(10), status: 'Active', redemptions: 412 },
  { id: 'pr-2', name: 'Free Delivery over $25', type: 'Flat', value: 2.5, code: 'FREEDEL', channel: 'Delivery', startsAt: daysFromNow(-8), endsAt: daysFromNow(22), status: 'Active', redemptions: 268 },
  { id: 'pr-3', name: 'Buy 1 Get 1 Zinger Tuesday', type: 'BOGO', value: 100, code: 'BOGOTUE', channel: 'All', startsAt: daysFromNow(-30), endsAt: daysFromNow(30), status: 'Active', redemptions: 530 },
  { id: 'pr-4', name: 'Late Night Happy Hour', type: 'Happy Hour', value: 20, code: 'NIGHT20', channel: 'All', startsAt: daysFromNow(3), endsAt: daysFromNow(33), status: 'Scheduled', redemptions: 0 },
  { id: 'pr-5', name: 'Eid Special 25%', type: 'Percentage', value: 25, code: 'EID25', channel: 'Online', startsAt: daysFromNow(-120), endsAt: daysFromNow(-110), status: 'Expired', redemptions: 1890 },
  { id: 'pr-6', name: 'App First Order $5 Off', type: 'Flat', value: 5, code: 'WELCOME5', channel: 'Online', startsAt: daysFromNow(0), endsAt: daysFromNow(60), status: 'Draft', redemptions: 0 },
]

export const getMenuItems = async (): Promise<MenuItem[]> => {
  const items = await request<Partial<MenuItem>[]>('/menu', menuItems)

  // The API owns the operational menu fields. The richer web menu UI still
  // has presentation/analytics fields that are not in the MVP API contract,
  // so preserve those local values until their backend schema is added.
  return items.map((item) => {
    const local = menuItems.find((candidate) => candidate.id === item.id)
    return {
      ...(local ?? m(item.id ?? '', item.name ?? 'Menu item', item.emoji ?? '🍽️', (item.category as MenuCategory | undefined) ?? 'Starters', item.price ?? 0, 0, item.station ?? 'Cold', item.prepMins ?? 0, 0)),
      ...item,
      variants: item.variants ?? local?.variants ?? [],
      addons: item.addons ?? local?.addons ?? [],
      dayParts: item.dayParts ?? local?.dayParts ?? ['Lunch', 'Dinner'],
      soldWeek: item.soldWeek ?? local?.soldWeek ?? 0,
    }
  })
}
export const saveMenuItem = (item: MenuItem) => mutate<MenuItem>(`/menu/items/${item.id}`, 'PUT', item)
export const createMenuItem = (item: MenuItem) => mutate<MenuItem>('/menu/items', 'POST', item)
export const getRecipes = () => request<Recipe[]>('/menu/recipes', recipes)
export const getCombos = () => request<Combo[]>('/menu/combos', combos)
export const getPromotions = () => request<Promotion[]>('/menu/promotions', promotions)
export const savePromotion = (p: Promotion) => mutate<Promotion>('/menu/promotions', 'POST', p)

/* ------------------------------------------------------------------ */
/* Orders / POS                                                        */
/* ------------------------------------------------------------------ */

export type OrderStatus = 'New' | 'Preparing' | 'Ready' | 'Served' | 'Out for delivery' | 'Completed' | 'Cancelled' | 'Refunded'

export interface OrderLine {
  itemId: string
  name: string
  emoji: string
  qty: number
  price: number
  station: Station
  modifiers: string[]
  notes?: string
}

export interface Order {
  id: string
  number: number
  type: OrderType
  channel: OrderChannel
  table?: string
  customer: string
  phone?: string
  items: OrderLine[]
  subtotal: number
  discount: number
  tax: number
  serviceCharge: number
  deliveryFee: number
  total: number
  status: OrderStatus
  paymentStatus: 'Paid' | 'Unpaid' | 'Refunded' | 'Partial'
  paymentMethod?: PaymentMethod
  server: string
  branch: Branch
  createdAt: string
  /** AI predicted ready time in minutes */
  predictedMins: number
  priority: 'Normal' | 'High' | 'Rush'
}

export const TAX_RATE = 0.16
export const SERVICE_RATE = 0.05

function line(id: string, qty: number, modifiers: string[] = [], notes?: string): OrderLine {
  const it = menuItems.find((x) => x.id === id)!
  return { itemId: id, name: it.name, emoji: it.emoji, qty, price: it.price, station: it.station, modifiers, notes }
}

function order(
  n: number,
  type: OrderType,
  channel: OrderChannel,
  customer: string,
  items: OrderLine[],
  status: OrderStatus,
  mins: number,
  extra: Partial<Order> = {},
): Order {
  const subtotal = +items.reduce((s, l) => s + l.qty * l.price, 0).toFixed(2)
  const discount = extra.discount ?? 0
  const serviceCharge = type === 'Dine-in' ? +((subtotal - discount) * SERVICE_RATE).toFixed(2) : 0
  const deliveryFee = type === 'Delivery' ? 2.5 : 0
  const tax = +((subtotal - discount) * TAX_RATE).toFixed(2)
  return {
    id: `ord-${n}`,
    number: n,
    type,
    channel,
    customer,
    items,
    subtotal,
    discount,
    tax,
    serviceCharge,
    deliveryFee,
    total: +(subtotal - discount + tax + serviceCharge + deliveryFee).toFixed(2),
    status,
    paymentStatus: ['Completed', 'Served'].includes(status) ? 'Paid' : status === 'Refunded' ? 'Refunded' : channel === 'POS' ? 'Unpaid' : 'Paid',
    paymentMethod: channel === 'POS' ? 'Cash' : 'Card',
    server: 'Bilal Ahmed',
    branch: 'Downtown',
    createdAt: minutesAgo(mins),
    predictedMins: 18,
    priority: 'Normal',
    ...extra,
  }
}

export const orders: Order[] = [
  order(1058, 'Dine-in', 'POS', 'Table T4 guests', [line('mi-09', 1, ['Full']), line('mi-17', 4), line('mi-29', 3)], 'New', 2, { table: 'T4', server: 'Hamza Riaz', predictedMins: 24 }),
  order(1057, 'Delivery', 'Foodpanda', 'Sana Malik', [line('mi-14', 2, [], 'Extra raita'), line('mi-26', 2)], 'New', 3, { phone: '+92 300 4412290', predictedMins: 14, priority: 'High' }),
  order(1056, 'Takeaway', 'POS', 'Usman Tariq', [line('mi-20', 2, ['Cheese slice', 'Make it a meal']), line('mi-32', 2)], 'Preparing', 6, { predictedMins: 9 }),
  order(1055, 'Dine-in', 'POS', 'Table T9 guests', [line('mi-05', 2, ['Beef']), line('mi-06', 1), line('mi-18', 3), line('mi-30', 2)], 'Preparing', 9, { table: 'T9', server: 'Ali Raza', predictedMins: 17 }),
  order(1054, 'Delivery', 'Careem', 'Hira Javed', [line('mi-23', 1, ['Chicken']), line('mi-25', 1, ['Grilled chicken'])], 'Preparing', 11, { predictedMins: 15, priority: 'Rush' }),
  order(1053, 'Dine-in', 'POS', 'Table V1 guests', [line('mi-07', 2), line('mi-10', 1, ['Full']), line('mi-19', 4), line('mi-28', 2)], 'Preparing', 13, { table: 'V1', server: 'Hamza Riaz', predictedMins: 30, priority: 'High' }),
  order(1052, 'Takeaway', 'Mobile App', 'Faisal Qureshi', [line('mi-15', 3), line('mi-32', 3)], 'Ready', 15, { predictedMins: 10 }),
  order(1051, 'Delivery', 'Website', 'Ayesha Noor', [line('mi-11', 1), line('mi-17', 2), line('mi-12', 1)], 'Out for delivery', 22, { predictedMins: 16 }),
  order(1050, 'Dine-in', 'POS', 'Table T2 guests', [line('mi-01', 1), line('mi-08', 1, ['Full']), line('mi-17', 2), line('mi-29', 2)], 'Served', 28, { table: 'T2', server: 'Ali Raza' }),
  order(1049, 'Delivery', 'Uber Eats', 'Kamran Shah', [line('mi-21', 2, ['Extra patty']), line('mi-03', 1, ['Peri Peri'])], 'Out for delivery', 31, { predictedMins: 12 }),
  order(1048, 'Dine-in', 'POS', 'Table F3 guests', [line('mi-14', 2), line('mi-09', 1, ['Half']), line('mi-18', 4), line('mi-27', 3)], 'Served', 36, { table: 'F3', server: 'Zainab Iqbal' }),
  order(1047, 'Takeaway', 'POS', 'Nadia Hussain', [line('mi-22', 3), line('mi-31', 2, ['Karak'])], 'Completed', 44, { paymentMethod: 'Wallet' }),
  order(1046, 'Delivery', 'Deliveroo', 'Ahmed Bashir', [line('mi-24', 1, ['Pepper sauce']), line('mi-28', 1)], 'Completed', 52, {}),
  order(1045, 'Dine-in', 'POS', 'Table T7 guests', [line('mi-02', 1), line('mi-13', 1), line('mi-16', 1), line('mi-17', 2)], 'Completed', 58, { table: 'T7', server: 'Zainab Iqbal', paymentMethod: 'Card' }),
  order(1044, 'Delivery', 'Foodpanda', 'Rabia Saleem', [line('mi-15', 1), line('mi-04', 1)], 'Cancelled', 66, { paymentStatus: 'Refunded' }),
  order(1043, 'Dine-in', 'POS', 'Table T1 guests', [line('mi-20', 1), line('mi-23', 1), line('mi-29', 2)], 'Refunded', 74, { table: 'T1', server: 'Hamza Riaz', paymentStatus: 'Refunded' }),
  order(1042, 'Takeaway', 'Website', 'Zeeshan Ali', [line('mi-14', 4), line('mi-26', 4)], 'Completed', 85, { discount: 6, paymentMethod: 'Card' }),
  order(1041, 'Dine-in', 'POS', 'Table T5 guests', [line('mi-05', 1), line('mi-09', 1, ['Full']), line('mi-17', 3), line('mi-32', 4)], 'Completed', 96, { table: 'T5', server: 'Ali Raza', paymentMethod: 'Card' }),
  order(1040, 'Delivery', 'Careem', 'Mehwish Akhtar', [line('mi-11', 2), line('mi-18', 4)], 'Completed', 110, {}),
  order(1039, 'Dine-in', 'POS', 'Table T8 guests', [line('mi-01', 2), line('mi-14', 2), line('mi-30', 2)], 'Completed', 124, { table: 'T8', server: 'Zainab Iqbal', paymentMethod: 'Wallet' }),
]

export const getOrders = () => request<Order[]>('/orders', orders)
export const createOrder = (o: Order) => mutate<Order>('/orders', 'POST', o)
export const updateOrderStatus = (id: string, status: OrderStatus) => mutate<{ id: string; status: OrderStatus }>(`/orders/${id}/status`, 'PATCH', { id, status })
export const refundOrder = (id: string, amount: number, reason: string) => mutate(`/orders/${id}/refund`, 'POST', { id, amount, reason })
export const payOrder = (id: string, payments: { method: PaymentMethod; amount: number }[]) => mutate(`/orders/${id}/payments`, 'POST', { id, payments })

/* ------------------------------------------------------------------ */
/* Kitchen (KDS)                                                       */
/* ------------------------------------------------------------------ */

export type TicketStatus = 'New' | 'Preparing' | 'Ready' | 'Served'

export interface TicketItem {
  name: string
  qty: number
  station: Station
  modifiers: string[]
  notes?: string
  done: boolean
}

export interface KitchenTicket {
  id: string
  orderNo: number
  type: OrderType
  table?: string
  channel: OrderChannel
  server: string
  items: TicketItem[]
  status: TicketStatus
  priority: 'Normal' | 'High' | 'Rush'
  createdAt: string
  predictedMins: number
  remake?: boolean
}

const ti = (id: string, qty: number, modifiers: string[] = [], notes?: string, done = false): TicketItem => {
  const it = menuItems.find((x) => x.id === id)!
  return { name: it.name, qty, station: it.station, modifiers, notes, done }
}

export const kitchenTickets: KitchenTicket[] = [
  { id: 'kt-1', orderNo: 1058, type: 'Dine-in', table: 'T4', channel: 'POS', server: 'Hamza Riaz', status: 'New', priority: 'Normal', createdAt: minutesAgo(1.5), predictedMins: 22, items: [ti('mi-09', 1, ['Full'], 'Less oil'), ti('mi-17', 4), ti('mi-29', 3)] },
  { id: 'kt-2', orderNo: 1057, type: 'Delivery', channel: 'Foodpanda', server: 'Online', status: 'New', priority: 'High', createdAt: minutesAgo(3), predictedMins: 12, items: [ti('mi-14', 2, [], 'Extra raita'), ti('mi-26', 2)] },
  { id: 'kt-3', orderNo: 1059, type: 'Takeaway', channel: 'Mobile App', server: 'Online', status: 'New', priority: 'Normal', createdAt: minutesAgo(0.5), predictedMins: 10, items: [ti('mi-22', 2), ti('mi-03', 1, ['Honey Garlic']), ti('mi-32', 2)] },
  { id: 'kt-4', orderNo: 1056, type: 'Takeaway', channel: 'POS', server: 'Sadia Pervez', status: 'Preparing', priority: 'Normal', createdAt: minutesAgo(6), predictedMins: 9, items: [ti('mi-20', 2, ['Cheese slice', 'Meal'], undefined, true), ti('mi-32', 2, [], undefined, true)] },
  { id: 'kt-5', orderNo: 1055, type: 'Dine-in', table: 'T9', channel: 'POS', server: 'Ali Raza', status: 'Preparing', priority: 'Normal', createdAt: minutesAgo(9), predictedMins: 16, items: [ti('mi-05', 2, ['Beef'], undefined, true), ti('mi-06', 1), ti('mi-18', 3), ti('mi-30', 2, [], undefined, true)] },
  { id: 'kt-6', orderNo: 1054, type: 'Delivery', channel: 'Careem', server: 'Online', status: 'Preparing', priority: 'Rush', createdAt: minutesAgo(11), predictedMins: 13, items: [ti('mi-23', 1, ['Chicken']), ti('mi-25', 1, ['Grilled chicken'], undefined, true)] },
  { id: 'kt-7', orderNo: 1053, type: 'Dine-in', table: 'V1', channel: 'POS', server: 'Hamza Riaz', status: 'Preparing', priority: 'High', createdAt: minutesAgo(19), predictedMins: 28, items: [ti('mi-07', 2, [], 'Medium well'), ti('mi-10', 1, ['Full']), ti('mi-19', 4), ti('mi-28', 2)] },
  { id: 'kt-8', orderNo: 1052, type: 'Takeaway', channel: 'Mobile App', server: 'Online', status: 'Ready', priority: 'Normal', createdAt: minutesAgo(15), predictedMins: 10, items: [ti('mi-15', 3, [], undefined, true), ti('mi-32', 3, [], undefined, true)] },
  { id: 'kt-9', orderNo: 1060, type: 'Dine-in', table: 'T6', channel: 'POS', server: 'Zainab Iqbal', status: 'Ready', priority: 'Normal', createdAt: minutesAgo(17), predictedMins: 14, remake: true, items: [ti('mi-11', 1, [], 'Remake – too salty', true), ti('mi-17', 2, [], undefined, true)] },
  { id: 'kt-10', orderNo: 1050, type: 'Dine-in', table: 'T2', channel: 'POS', server: 'Ali Raza', status: 'Served', priority: 'Normal', createdAt: minutesAgo(28), predictedMins: 20, items: [ti('mi-01', 1, [], undefined, true), ti('mi-08', 1, ['Full'], undefined, true), ti('mi-17', 2, [], undefined, true)] },
  { id: 'kt-11', orderNo: 1048, type: 'Dine-in', table: 'F3', channel: 'POS', server: 'Zainab Iqbal', status: 'Served', priority: 'Normal', createdAt: minutesAgo(36), predictedMins: 18, items: [ti('mi-14', 2, [], undefined, true), ti('mi-09', 1, ['Half'], undefined, true)] },
]

export interface QualityCheck {
  id: string
  orderNo: number
  item: string
  chef: string
  station: Station
  result: 'Passed' | 'Remake' | 'Warning'
  reason?: string
  time: string
}

export const qualityChecks: QualityCheck[] = [
  { id: 'qc-1', orderNo: 1060, item: 'Butter Chicken', chef: 'Imran Butt', station: 'Wok', result: 'Remake', reason: 'Too salty – guest complaint', time: minutesAgo(12) },
  { id: 'qc-2', orderNo: 1052, item: 'Chicken Biryani x3', chef: 'Imran Butt', station: 'Wok', result: 'Passed', time: minutesAgo(14) },
  { id: 'qc-3', orderNo: 1050, item: 'Tandoori Chicken (Full)', chef: 'Rashid Mehmood', station: 'Tandoor', result: 'Passed', time: minutesAgo(22) },
  { id: 'qc-4', orderNo: 1049, item: 'Smash Beef Burger', chef: 'Kashif Nawaz', station: 'Grill', result: 'Warning', reason: 'Plating – bun slightly burnt', time: minutesAgo(30) },
  { id: 'qc-5', orderNo: 1048, item: 'Mutton Biryani x2', chef: 'Imran Butt', station: 'Wok', result: 'Passed', time: minutesAgo(33) },
  { id: 'qc-6', orderNo: 1046, item: 'Grilled Chicken Steak', chef: 'Kashif Nawaz', station: 'Grill', result: 'Passed', time: minutesAgo(48) },
  { id: 'qc-7', orderNo: 1043, item: 'Alfredo Pasta', chef: 'Imran Butt', station: 'Wok', result: 'Remake', reason: 'Sauce split – returned', time: minutesAgo(70) },
  { id: 'qc-8', orderNo: 1041, item: 'Seekh Kebab', chef: 'Kashif Nawaz', station: 'Grill', result: 'Passed', time: minutesAgo(92) },
]

export interface StationLoad {
  station: Station
  chef: string
  activeItems: number
  capacity: number
  avgPrepMins: number
  targetMins: number
}

export const stationLoads: StationLoad[] = [
  { station: 'Grill', chef: 'Kashif Nawaz', activeItems: 9, capacity: 12, avgPrepMins: 13.2, targetMins: 12 },
  { station: 'Tandoor', chef: 'Rashid Mehmood', activeItems: 11, capacity: 16, avgPrepMins: 5.4, targetMins: 6 },
  { station: 'Wok', chef: 'Imran Butt', activeItems: 10, capacity: 10, avgPrepMins: 17.8, targetMins: 15 },
  { station: 'Cold', chef: 'Sobia Khan', activeItems: 4, capacity: 10, avgPrepMins: 4.1, targetMins: 5 },
  { station: 'Drinks', chef: 'Waqas Ali', activeItems: 6, capacity: 14, avgPrepMins: 2.6, targetMins: 3 },
]

export const prepTimeTrend = [
  { h: '12:00', actual: 14, predicted: 13, orders: 18 },
  { h: '13:00', actual: 17, predicted: 16, orders: 34 },
  { h: '14:00', actual: 15, predicted: 15, orders: 26 },
  { h: '15:00', actual: 11, predicted: 12, orders: 12 },
  { h: '16:00', actual: 10, predicted: 11, orders: 10 },
  { h: '17:00', actual: 12, predicted: 12, orders: 16 },
  { h: '18:00', actual: 14, predicted: 15, orders: 24 },
  { h: '19:00', actual: 18, predicted: 17, orders: 38 },
  { h: '20:00', actual: 21, predicted: 20, orders: 46 },
  { h: '21:00', predicted: 23, orders: 44 },
  { h: '22:00', predicted: 19, orders: 31 },
  { h: '23:00', predicted: 14, orders: 17 },
]

export const getKitchenTickets = () => request<KitchenTicket[]>('/kitchen/tickets', kitchenTickets)
export const updateTicket = (t: KitchenTicket) => mutate<KitchenTicket>(`/kitchen/tickets/${t.id}`, 'PATCH', t)
export const getQualityChecks = () => request<QualityCheck[]>('/kitchen/quality-checks', qualityChecks)
export const getStationLoads = () => request<StationLoad[]>('/kitchen/stations', stationLoads)

/* ------------------------------------------------------------------ */
/* Tables & reservations                                               */
/* ------------------------------------------------------------------ */

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning'
export type FloorArea = 'Main Hall' | 'Terrace' | 'Family' | 'VIP'
export const FLOOR_AREAS: FloorArea[] = ['Main Hall', 'Terrace', 'Family', 'VIP']

export interface DiningTable {
  id: string
  name: string
  area: FloorArea
  seats: number
  shape: 'round' | 'square' | 'rect'
  status: TableStatus
  /** Grid position within the area (1-based) */
  col: number
  row: number
  guests?: number
  guestName?: string
  server?: string
  seatedAt?: string
  billTotal?: number
  reservedFor?: string
}

const tb = (name: string, area: FloorArea, seats: number, shape: DiningTable['shape'], col: number, row: number, status: TableStatus, extra: Partial<DiningTable> = {}): DiningTable => ({
  id: name,
  name,
  area,
  seats,
  shape,
  col,
  row,
  status,
  ...extra,
})

export const diningTables: DiningTable[] = [
  tb('T1', 'Main Hall', 2, 'round', 1, 1, 'Available'),
  tb('T2', 'Main Hall', 4, 'square', 2, 1, 'Occupied', { guests: 4, guestName: 'Walk-in', server: 'Ali Raza', seatedAt: minutesAgo(48), billTotal: 51.4 }),
  tb('T3', 'Main Hall', 4, 'square', 3, 1, 'Cleaning'),
  tb('T4', 'Main Hall', 6, 'rect', 4, 1, 'Occupied', { guests: 5, guestName: 'Mr. Farooq', server: 'Hamza Riaz', seatedAt: minutesAgo(6), billTotal: 44.2 }),
  tb('T5', 'Main Hall', 2, 'round', 1, 2, 'Available'),
  tb('T6', 'Main Hall', 4, 'square', 2, 2, 'Occupied', { guests: 3, guestName: 'Walk-in', server: 'Zainab Iqbal', seatedAt: minutesAgo(32), billTotal: 22.8 }),
  tb('T7', 'Main Hall', 4, 'square', 3, 2, 'Reserved', { reservedFor: 'Khan family · 8:30 PM' }),
  tb('T8', 'Main Hall', 6, 'rect', 4, 2, 'Available'),
  tb('T9', 'Main Hall', 4, 'square', 1, 3, 'Occupied', { guests: 4, guestName: 'Dr. Saeed', server: 'Ali Raza', seatedAt: minutesAgo(12), billTotal: 46.1 }),
  tb('T10', 'Main Hall', 2, 'round', 2, 3, 'Available'),
  tb('R1', 'Terrace', 2, 'round', 1, 1, 'Occupied', { guests: 2, guestName: 'Anam & Bilal', server: 'Sadia Pervez', seatedAt: minutesAgo(22), billTotal: 31.6 }),
  tb('R2', 'Terrace', 2, 'round', 2, 1, 'Available'),
  tb('R3', 'Terrace', 4, 'square', 3, 1, 'Reserved', { reservedFor: 'Hassan · 8:00 PM' }),
  tb('R4', 'Terrace', 4, 'square', 1, 2, 'Available'),
  tb('R5', 'Terrace', 6, 'rect', 2, 2, 'Cleaning'),
  tb('F1', 'Family', 8, 'rect', 1, 1, 'Occupied', { guests: 7, guestName: 'Sheikh family', server: 'Zainab Iqbal', seatedAt: minutesAgo(55), billTotal: 128.3 }),
  tb('F2', 'Family', 6, 'rect', 2, 1, 'Reserved', { reservedFor: 'Malik party · 9:00 PM' }),
  tb('F3', 'Family', 6, 'rect', 1, 2, 'Occupied', { guests: 6, guestName: 'Walk-in', server: 'Zainab Iqbal', seatedAt: minutesAgo(36), billTotal: 74.9 }),
  tb('F4', 'Family', 10, 'rect', 2, 2, 'Available'),
  tb('V1', 'VIP', 8, 'rect', 1, 1, 'Occupied', { guests: 8, guestName: 'Corporate – Systems Ltd', server: 'Hamza Riaz', seatedAt: minutesAgo(19), billTotal: 186.5 }),
  tb('V2', 'VIP', 4, 'round', 2, 1, 'Reserved', { reservedFor: 'Mr. Chaudhry · 8:45 PM' }),
]

export interface Reservation {
  id: string
  guest: string
  phone: string
  party: number
  time: string
  table?: string
  area: FloorArea
  source: 'Online' | 'Phone' | 'Walk-in' | 'Website' | 'Google'
  status: 'Confirmed' | 'Pending' | 'Seated' | 'Cancelled' | 'Completed'
  occasion?: string
  notes?: string
  /** AI no-show probability (0-1) */
  noShowRisk: number
  visits: number
}

const inMins = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString()

export const reservations: Reservation[] = [
  { id: 'rs-1', guest: 'Hassan Raza', phone: '+92 321 5541200', party: 4, time: inMins(25), table: 'R3', area: 'Terrace', source: 'Online', status: 'Confirmed', occasion: 'Anniversary', noShowRisk: 0.08, visits: 6 },
  { id: 'rs-2', guest: 'Khan family', phone: '+92 300 1188772', party: 4, time: inMins(55), table: 'T7', area: 'Main Hall', source: 'Phone', status: 'Confirmed', noShowRisk: 0.12, visits: 14 },
  { id: 'rs-3', guest: 'Imtiaz Chaudhry', phone: '+92 333 9087121', party: 3, time: inMins(70), table: 'V2', area: 'VIP', source: 'Phone', status: 'Confirmed', notes: 'Prefers corner, no onion', noShowRisk: 0.05, visits: 22 },
  { id: 'rs-4', guest: 'Malik party', phone: '+92 345 7612034', party: 6, time: inMins(85), table: 'F2', area: 'Family', source: 'Website', status: 'Confirmed', occasion: 'Birthday', notes: 'Cake at 9:30', noShowRisk: 0.18, visits: 2 },
  { id: 'rs-5', guest: 'Sara Ahmed', phone: '+92 301 2290455', party: 2, time: inMins(100), area: 'Terrace', source: 'Google', status: 'Pending', noShowRisk: 0.41, visits: 0 },
  { id: 'rs-6', guest: 'Junaid Akram', phone: '+92 302 6612387', party: 5, time: inMins(115), area: 'Main Hall', source: 'Online', status: 'Pending', noShowRisk: 0.63, visits: 1 },
  { id: 'rs-7', guest: 'Fatima Zahra', phone: '+92 312 4401922', party: 2, time: inMins(130), area: 'Main Hall', source: 'Website', status: 'Confirmed', noShowRisk: 0.22, visits: 3 },
  { id: 'rs-8', guest: 'Corporate – TPL', phone: '+92 21 111 000 300', party: 10, time: inMins(60 * 24 + 60), area: 'Family', source: 'Phone', status: 'Confirmed', occasion: 'Team dinner', noShowRisk: 0.04, visits: 5 },
  { id: 'rs-9', guest: 'Omer Farooq', phone: '+92 300 8800213', party: 4, time: inMins(-6), table: 'T4', area: 'Main Hall', source: 'Walk-in', status: 'Seated', noShowRisk: 0, visits: 9 },
  { id: 'rs-10', guest: 'Nimra Shah', phone: '+92 331 5512870', party: 2, time: inMins(-45), area: 'Terrace', source: 'Online', status: 'Cancelled', noShowRisk: 0.7, visits: 1 },
  { id: 'rs-11', guest: 'Dr. Saeed Anwar', phone: '+92 322 4417780', party: 4, time: inMins(-12), table: 'T9', area: 'Main Hall', source: 'Online', status: 'Seated', noShowRisk: 0, visits: 11 },
  { id: 'rs-12', guest: 'Ali Haider', phone: '+92 303 1234560', party: 3, time: inMins(60 * 24 + 180), area: 'Terrace', source: 'Google', status: 'Pending', noShowRisk: 0.35, visits: 0 },
]

export interface WaitlistEntry {
  id: string
  guest: string
  phone: string
  party: number
  addedAt: string
  quotedMins: number
  preference: FloorArea | 'Any'
  notified: boolean
}

export const waitlist: WaitlistEntry[] = [
  { id: 'wl-1', guest: 'Rizwan Akhtar', phone: '+92 300 7765123', party: 2, addedAt: minutesAgo(14), quotedMins: 15, preference: 'Terrace', notified: true },
  { id: 'wl-2', guest: 'Mahnoor Iqbal', phone: '+92 321 9087654', party: 4, addedAt: minutesAgo(9), quotedMins: 20, preference: 'Main Hall', notified: false },
  { id: 'wl-3', guest: 'Tahir Family', phone: '+92 333 1122334', party: 7, addedAt: minutesAgo(5), quotedMins: 35, preference: 'Family', notified: false },
  { id: 'wl-4', guest: 'Saad Mir', phone: '+92 345 6655443', party: 2, addedAt: minutesAgo(2), quotedMins: 25, preference: 'Any', notified: false },
]

export const turnoverByHour = [
  { h: '12', turns: 1.1, avgMins: 52 },
  { h: '13', turns: 1.6, avgMins: 48 },
  { h: '14', turns: 1.3, avgMins: 55 },
  { h: '15', turns: 0.6, avgMins: 61 },
  { h: '16', turns: 0.5, avgMins: 64 },
  { h: '17', turns: 0.8, avgMins: 58 },
  { h: '18', turns: 1.2, avgMins: 57 },
  { h: '19', turns: 1.7, avgMins: 63 },
  { h: '20', turns: 1.9, avgMins: 68 },
  { h: '21', turns: 1.5, avgMins: 72 },
]

export const getTables = () => request<DiningTable[]>('/tables', diningTables)
export const updateTable = (t: DiningTable) => mutate<DiningTable>(`/tables/${t.id}`, 'PATCH', t)
export const getReservations = () => request<Reservation[]>('/reservations', reservations)
export const createReservation = (r: Reservation) => mutate<Reservation>('/reservations', 'POST', r)
export const getWaitlist = () => request<WaitlistEntry[]>('/waitlist', waitlist)

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export interface Ingredient {
  id: string
  name: string
  emoji: string
  category: 'Meat & Poultry' | 'Dairy' | 'Produce' | 'Dry Goods' | 'Spices' | 'Beverages' | 'Packaging'
  unit: string
  stock: number
  par: number
  reorderPoint: number
  costPerUnit: number
  supplier: string
  expiry: string
  /** Average daily consumption */
  usagePerDay: number
  branch: Branch
  storage: 'Walk-in Chiller' | 'Freezer' | 'Dry Store' | 'Bar'
  updatedAt: string
}

const ing = (
  id: string,
  name: string,
  emoji: string,
  category: Ingredient['category'],
  unit: string,
  stock: number,
  par: number,
  reorderPoint: number,
  costPerUnit: number,
  supplier: string,
  expiryDays: number,
  usagePerDay: number,
  storage: Ingredient['storage'],
  updatedMins = 30,
): Ingredient => ({ id, name, emoji, category, unit, stock, par, reorderPoint, costPerUnit, supplier, expiry: daysFromNow(expiryDays), usagePerDay, branch: 'Downtown', storage, updatedAt: minutesAgo(updatedMins) })

export const ingredients: Ingredient[] = [
  ing('in-01', 'Chicken (bone-in)', '🐔', 'Meat & Poultry', 'kg', 38, 80, 40, 5.8, 'K&N Foods', 2, 32, 'Walk-in Chiller', 4),
  ing('in-02', 'Chicken Fillet', '🍗', 'Meat & Poultry', 'kg', 22, 40, 15, 9.0, 'K&N Foods', 3, 11, 'Walk-in Chiller', 12),
  ing('in-03', 'Mutton', '🐐', 'Meat & Poultry', 'kg', 9, 35, 12, 17.2, 'Al-Madina Meats', 2, 10, 'Walk-in Chiller', 8),
  ing('in-04', 'Beef Mince', '🥩', 'Meat & Poultry', 'kg', 14, 25, 10, 9.6, 'Al-Madina Meats', 1, 9, 'Walk-in Chiller', 20),
  ing('in-05', 'Lamb Chops', '🍖', 'Meat & Poultry', 'kg', 6, 12, 5, 21.0, 'Al-Madina Meats', 4, 3, 'Freezer', 60),
  ing('in-06', 'Basmati Rice', '🍚', 'Dry Goods', 'kg', 6, 100, 25, 2.8, 'Guard Rice Mills', 240, 22, 'Dry Store', 2),
  ing('in-07', 'Flour (Maida)', '🌾', 'Dry Goods', 'kg', 64, 120, 40, 0.8, 'Sunridge Foods', 120, 18, 'Dry Store', 90),
  ing('in-08', 'Cooking Oil', '🛢️', 'Dry Goods', 'L', 48, 80, 30, 2.75, 'Dalda Foods', 300, 14, 'Dry Store', 45),
  ing('in-09', 'Yoghurt', '🥛', 'Dairy', 'kg', 11, 25, 10, 2.4, 'Nestlé Professional', 4, 7, 'Walk-in Chiller', 15),
  ing('in-10', 'Butter', '🧈', 'Dairy', 'kg', 7.5, 15, 5, 14.0, 'Nurpur Dairy', 30, 2.2, 'Walk-in Chiller', 33),
  ing('in-11', 'Cooking Cream', '🥛', 'Dairy', 'L', 4, 18, 6, 7.9, 'Nestlé Professional', 6, 3.5, 'Walk-in Chiller', 18),
  ing('in-12', 'Paneer', '🧀', 'Dairy', 'kg', 5, 10, 4, 8.5, 'Nurpur Dairy', 3, 1.6, 'Walk-in Chiller', 70),
  ing('in-13', 'Tomatoes', '🍅', 'Produce', 'kg', 26, 50, 20, 1.5, 'Fresh Farms Co.', 3, 18, 'Walk-in Chiller', 5),
  ing('in-14', 'Onions', '🧅', 'Produce', 'kg', 42, 60, 20, 1.1, 'Fresh Farms Co.', 14, 15, 'Dry Store', 25),
  ing('in-15', 'Green Chillies', '🌶️', 'Produce', 'kg', 2.5, 6, 2, 4.0, 'Fresh Farms Co.', 4, 1.4, 'Walk-in Chiller', 40),
  ing('in-16', 'Coriander', '🌿', 'Produce', 'kg', 0.8, 3, 1, 5.0, 'Fresh Farms Co.', 1, 0.9, 'Walk-in Chiller', 50),
  ing('in-17', 'Lettuce', '🥬', 'Produce', 'kg', 3, 6, 2, 3.0, 'Fresh Farms Co.', 2, 1.3, 'Walk-in Chiller', 80),
  ing('in-18', 'Mint Leaves', '🌱', 'Produce', 'kg', 1.2, 4, 1.5, 6.0, 'Fresh Farms Co.', 2, 1.1, 'Bar', 30),
  ing('in-19', 'Saffron', '🟧', 'Spices', 'g', 35, 50, 20, 6.0, 'Shan Foods', 365, 4, 'Dry Store', 300),
  ing('in-20', 'Karahi Masala', '🧂', 'Spices', 'kg', 3.2, 6, 2, 14.0, 'Shan Foods', 180, 0.8, 'Dry Store', 200),
  ing('in-21', 'Charcoal', '⚫', 'Dry Goods', 'kg', 55, 120, 50, 2.0, 'Lahore Fuel Depot', 999, 28, 'Dry Store', 15),
  ing('in-22', 'Burger Buns', '🍞', 'Dry Goods', 'pc', 60, 150, 60, 0.35, 'Dawn Bread', 3, 52, 'Dry Store', 10),
  ing('in-23', 'Soft Drink Cans', '🥤', 'Beverages', 'pc', 210, 300, 100, 0.5, 'Pepsi Bottlers', 160, 60, 'Bar', 120),
  ing('in-24', 'Takeaway Boxes', '📦', 'Packaging', 'pc', 180, 600, 200, 0.18, 'PackPro Pakistan', 999, 95, 'Dry Store', 240),
]

export type MovementType = 'Stock In' | 'Stock Out' | 'Transfer' | 'Wastage' | 'Adjustment'

export interface StockMovement {
  id: string
  date: string
  type: MovementType
  ingredient: string
  qty: number
  unit: string
  from?: string
  to?: string
  reference: string
  by: string
  value: number
}

export const stockMovements: StockMovement[] = [
  { id: 'sm-1', date: minutesAgo(25), type: 'Stock In', ingredient: 'Chicken (bone-in)', qty: 40, unit: 'kg', from: 'K&N Foods', to: 'Downtown', reference: 'GRN-2291', by: 'Tariq Mehmood', value: 232 },
  { id: 'sm-2', date: minutesAgo(60), type: 'Stock Out', ingredient: 'Basmati Rice', qty: 18, unit: 'kg', from: 'Dry Store', to: 'Kitchen – Wok', reference: 'REQ-881', by: 'Imran Butt', value: 50.4 },
  { id: 'sm-3', date: minutesAgo(95), type: 'Transfer', ingredient: 'Mutton', qty: 8, unit: 'kg', from: 'Mall Road', to: 'Downtown', reference: 'TRF-140', by: 'Tariq Mehmood', value: 137.6 },
  { id: 'sm-4', date: minutesAgo(130), type: 'Wastage', ingredient: 'Coriander', qty: 0.6, unit: 'kg', from: 'Walk-in Chiller', reference: 'WST-322', by: 'Sobia Khan', value: 3 },
  { id: 'sm-5', date: minutesAgo(180), type: 'Stock In', ingredient: 'Tomatoes', qty: 30, unit: 'kg', from: 'Fresh Farms Co.', to: 'Downtown', reference: 'GRN-2290', by: 'Tariq Mehmood', value: 45 },
  { id: 'sm-6', date: minutesAgo(240), type: 'Transfer', ingredient: 'Burger Buns', qty: 80, unit: 'pc', from: 'Downtown', to: 'Airport', reference: 'TRF-139', by: 'Nauman Aslam', value: 28 },
  { id: 'sm-7', date: minutesAgo(300), type: 'Adjustment', ingredient: 'Cooking Oil', qty: -2, unit: 'L', reference: 'ADJ-77', by: 'Tariq Mehmood', value: -5.5 },
  { id: 'sm-8', date: minutesAgo(380), type: 'Stock Out', ingredient: 'Chicken Fillet', qty: 9, unit: 'kg', from: 'Walk-in Chiller', to: 'Kitchen – Grill', reference: 'REQ-880', by: 'Kashif Nawaz', value: 81 },
  { id: 'sm-9', date: minutesAgo(600), type: 'Wastage', ingredient: 'Cooking Cream', qty: 2, unit: 'L', from: 'Walk-in Chiller', reference: 'WST-321', by: 'Sobia Khan', value: 15.8 },
  { id: 'sm-10', date: minutesAgo(900), type: 'Stock In', ingredient: 'Soft Drink Cans', qty: 240, unit: 'pc', from: 'Pepsi Bottlers', to: 'Downtown', reference: 'GRN-2288', by: 'Nauman Aslam', value: 120 },
  { id: 'sm-11', date: minutesAgo(1200), type: 'Transfer', ingredient: 'Karahi Masala', qty: 1.5, unit: 'kg', from: 'Downtown', to: 'Mall Road', reference: 'TRF-138', by: 'Tariq Mehmood', value: 21 },
  { id: 'sm-12', date: minutesAgo(1500), type: 'Stock Out', ingredient: 'Charcoal', qty: 30, unit: 'kg', from: 'Dry Store', to: 'Kitchen – Grill', reference: 'REQ-879', by: 'Kashif Nawaz', value: 60 },
]

export interface WastageEntry {
  id: string
  date: string
  ingredient: string
  qty: number
  unit: string
  reason: 'Expired' | 'Spoiled' | 'Over-production' | 'Kitchen error' | 'Customer return' | 'Damaged'
  cost: number
  by: string
}

export const wastageLog: WastageEntry[] = [
  { id: 'ws-1', date: minutesAgo(130), ingredient: 'Coriander', qty: 0.6, unit: 'kg', reason: 'Spoiled', cost: 3, by: 'Sobia Khan' },
  { id: 'ws-2', date: minutesAgo(600), ingredient: 'Cooking Cream', qty: 2, unit: 'L', reason: 'Expired', cost: 15.8, by: 'Sobia Khan' },
  { id: 'ws-3', date: minutesAgo(720), ingredient: 'Chicken Biryani (portions)', qty: 6, unit: 'plate', reason: 'Over-production', cost: 19.8, by: 'Imran Butt' },
  { id: 'ws-4', date: minutesAgo(1300), ingredient: 'Butter Chicken', qty: 1, unit: 'plate', reason: 'Customer return', cost: 4.4, by: 'Zainab Iqbal' },
  { id: 'ws-5', date: minutesAgo(1600), ingredient: 'Tomatoes', qty: 3.5, unit: 'kg', reason: 'Spoiled', cost: 5.25, by: 'Sobia Khan' },
  { id: 'ws-6', date: minutesAgo(2100), ingredient: 'Garlic Naan', qty: 8, unit: 'pc', reason: 'Kitchen error', cost: 2.8, by: 'Rashid Mehmood' },
  { id: 'ws-7', date: minutesAgo(2900), ingredient: 'Lettuce', qty: 1.2, unit: 'kg', reason: 'Spoiled', cost: 3.6, by: 'Sobia Khan' },
  { id: 'ws-8', date: minutesAgo(3400), ingredient: 'Soft Drink Cans', qty: 6, unit: 'pc', reason: 'Damaged', cost: 3, by: 'Waqas Ali' },
]

export const consumptionTrend = [
  { day: 'Mon', consumption: 412, wastage: 14 },
  { day: 'Tue', consumption: 386, wastage: 11 },
  { day: 'Wed', consumption: 401, wastage: 18 },
  { day: 'Thu', consumption: 455, wastage: 12 },
  { day: 'Fri', consumption: 588, wastage: 21 },
  { day: 'Sat', consumption: 642, wastage: 26 },
  { day: 'Sun', consumption: 610, wastage: 19 },
]

export const demandForecast = [
  { day: 'Oct 4', actual: 31, forecast: 30 },
  { day: 'Oct 5', actual: 29, forecast: 31 },
  { day: 'Oct 6', actual: 33, forecast: 32 },
  { day: 'Oct 7', actual: 30, forecast: 31 },
  { day: 'Oct 8', actual: 36, forecast: 34 },
  { day: 'Oct 9', actual: 41, forecast: 40 },
  { day: 'Oct 10', actual: 38, forecast: 41, lower: 37, upper: 45 },
  { day: 'Oct 11', forecast: 44, lower: 39, upper: 49 },
  { day: 'Oct 12', forecast: 39, lower: 34, upper: 44 },
  { day: 'Oct 13', forecast: 32, lower: 28, upper: 36 },
  { day: 'Oct 14', forecast: 31, lower: 27, upper: 35 },
  { day: 'Oct 15', forecast: 34, lower: 29, upper: 39 },
  { day: 'Oct 16', forecast: 42, lower: 36, upper: 48 },
]

export const getIngredients = () => request<Ingredient[]>('/inventory/ingredients', ingredients)
export const saveIngredient = (i: Ingredient) => mutate<Ingredient>(`/inventory/ingredients/${i.id}`, 'PUT', i)
export const getStockMovements = () => request<StockMovement[]>('/inventory/movements', stockMovements)
export const createStockMovement = (s: StockMovement) => mutate<StockMovement>('/inventory/movements', 'POST', s)
export const getWastageLog = () => request<WastageEntry[]>('/inventory/wastage', wastageLog)
export const createPurchaseOrder = (po: { supplier: string; lines: { ingredient: string; qty: number }[] }) => mutate('/inventory/purchase-orders', 'POST', po)

/* ------------------------------------------------------------------ */
/* Delivery & takeaway                                                 */
/* ------------------------------------------------------------------ */

export interface DeliveryZone {
  id: string
  name: string
  radiusKm: number
  fee: number
  minOrder: number
  etaMins: number
  active: boolean
  ordersToday: number
  color: string
}

export const deliveryZones: DeliveryZone[] = [
  { id: 'z-1', name: 'Zone A – Gulberg & Main Blvd', radiusKm: 3, fee: 1.5, minOrder: 10, etaMins: 25, active: true, ordersToday: 46, color: '#10b981' },
  { id: 'z-2', name: 'Zone B – Model Town & Garden Town', radiusKm: 6, fee: 2.5, minOrder: 15, etaMins: 35, active: true, ordersToday: 31, color: '#0ea5e9' },
  { id: 'z-3', name: 'Zone C – DHA Phase 1–5', radiusKm: 9, fee: 3.5, minOrder: 20, etaMins: 45, active: true, ordersToday: 22, color: '#8b5cf6' },
  { id: 'z-4', name: 'Zone D – Johar Town & Valencia', radiusKm: 12, fee: 4.5, minOrder: 25, etaMins: 55, active: false, ordersToday: 0, color: '#f59e0b' },
]

export type DeliveryStatus = 'New' | 'Preparing' | 'Ready' | 'Assigned' | 'Picked up' | 'Out for delivery' | 'Delivered' | 'Cancelled'

export interface DeliveryOrder {
  id: string
  orderNo: number
  customer: string
  phone: string
  address: string
  zone: string
  channel: OrderChannel
  mode: 'Delivery' | 'Pickup'
  items: number
  summary: string
  total: number
  payment: 'Paid online' | 'Cash on delivery'
  status: DeliveryStatus
  rider?: string
  placedAt: string
  etaMins: number
  aiEtaMins: number
  distanceKm: number
  /** Position on the mock map (0-100) */
  x: number
  y: number
}

export const deliveryOrders: DeliveryOrder[] = [
  { id: 'do-1', orderNo: 1057, customer: 'Sana Malik', phone: '+92 300 4412290', address: 'House 21, Block H, Gulberg III', zone: 'Zone A', channel: 'Foodpanda', mode: 'Delivery', items: 4, summary: '2× Mutton Biryani, 2× Kheer', total: 37.6, payment: 'Paid online', status: 'New', placedAt: minutesAgo(3), etaMins: 30, aiEtaMins: 28, distanceKm: 2.1, x: 62, y: 30 },
  { id: 'do-2', orderNo: 1054, customer: 'Hira Javed', phone: '+92 321 7712004', address: 'Flat 4B, Askari 10', zone: 'Zone C', channel: 'Careem', mode: 'Delivery', items: 2, summary: 'Alfredo Pasta, Caesar Salad', total: 28.6, payment: 'Paid online', status: 'Preparing', placedAt: minutesAgo(11), etaMins: 45, aiEtaMins: 49, distanceKm: 7.8, x: 84, y: 76 },
  { id: 'do-3', orderNo: 1061, customer: 'Bilal Chaudhry', phone: '+92 333 4410098', address: '12-C Model Town Ext.', zone: 'Zone B', channel: 'Website', mode: 'Delivery', items: 5, summary: 'Chicken Karahi (Full), 3× Naan, 1.5L Drink', total: 41.2, payment: 'Cash on delivery', status: 'Ready', placedAt: minutesAgo(19), etaMins: 35, aiEtaMins: 33, distanceKm: 4.6, x: 30, y: 70 },
  { id: 'do-4', orderNo: 1051, customer: 'Ayesha Noor', phone: '+92 345 2200917', address: '88 Main Boulevard, Gulberg', zone: 'Zone A', channel: 'Website', mode: 'Delivery', items: 4, summary: 'Butter Chicken, Daal Makhani, 2× Naan', total: 34.1, payment: 'Paid online', status: 'Out for delivery', rider: 'Adeel Khan', placedAt: minutesAgo(22), etaMins: 25, aiEtaMins: 27, distanceKm: 2.8, x: 70, y: 42 },
  { id: 'do-5', orderNo: 1049, customer: 'Kamran Shah', phone: '+92 302 9911223', address: '5-A Garden Town', zone: 'Zone B', channel: 'Uber Eats', mode: 'Delivery', items: 3, summary: '2× Smash Burger, Wings', total: 36.2, payment: 'Paid online', status: 'Out for delivery', rider: 'Shahid Iqbal', placedAt: minutesAgo(31), etaMins: 35, aiEtaMins: 38, distanceKm: 5.2, x: 22, y: 48 },
  { id: 'do-6', orderNo: 1062, customer: 'Zara Sheikh', phone: '+92 311 8876541', address: 'DHA Phase 5, Street 14', zone: 'Zone C', channel: 'Mobile App', mode: 'Delivery', items: 3, summary: 'Lamb Chops, Kheer, Mint Margarita', total: 33.9, payment: 'Paid online', status: 'Assigned', rider: 'Naveed Anjum', placedAt: minutesAgo(16), etaMins: 45, aiEtaMins: 42, distanceKm: 8.4, x: 88, y: 60 },
  { id: 'do-7', orderNo: 1052, customer: 'Faisal Qureshi', phone: '+92 300 1100223', address: 'Counter pickup', zone: '—', channel: 'Mobile App', mode: 'Pickup', items: 6, summary: '3× Chicken Biryani, 3× Soft Drink', total: 46.3, payment: 'Paid online', status: 'Ready', placedAt: minutesAgo(15), etaMins: 15, aiEtaMins: 12, distanceKm: 0, x: 50, y: 50 },
  { id: 'do-8', orderNo: 1063, customer: 'Mariam Aziz', phone: '+92 322 5566778', address: 'Counter pickup', zone: '—', channel: 'Website', mode: 'Pickup', items: 2, summary: '2× Zinger Meal Deal', total: 25.3, payment: 'Cash on delivery', status: 'Preparing', placedAt: minutesAgo(5), etaMins: 15, aiEtaMins: 14, distanceKm: 0, x: 50, y: 50 },
  { id: 'do-9', orderNo: 1046, customer: 'Ahmed Bashir', phone: '+92 301 9988776', address: 'Liberty Heights, Gulberg', zone: 'Zone A', channel: 'Deliveroo', mode: 'Delivery', items: 2, summary: 'Grilled Steak, Lava Cake', total: 29.1, payment: 'Paid online', status: 'Delivered', rider: 'Adeel Khan', placedAt: minutesAgo(52), etaMins: 25, aiEtaMins: 24, distanceKm: 1.9, x: 58, y: 22 },
  { id: 'do-10', orderNo: 1040, customer: 'Mehwish Akhtar', phone: '+92 333 7766554', address: 'Faisal Town, Block C', zone: 'Zone B', channel: 'Careem', mode: 'Delivery', items: 6, summary: '2× Butter Chicken, 4× Butter Naan', total: 45.4, payment: 'Paid online', status: 'Delivered', rider: 'Shahid Iqbal', placedAt: minutesAgo(110), etaMins: 35, aiEtaMins: 36, distanceKm: 4.9, x: 18, y: 64 },
  { id: 'do-11', orderNo: 1044, customer: 'Rabia Saleem', phone: '+92 300 3344556', address: 'Cavalry Ground', zone: 'Zone C', channel: 'Foodpanda', mode: 'Delivery', items: 2, summary: 'Chicken Biryani, Dahi Puri', total: 22.1, payment: 'Paid online', status: 'Cancelled', placedAt: minutesAgo(66), etaMins: 45, aiEtaMins: 51, distanceKm: 6.9, x: 78, y: 84 },
]

export interface Rider {
  id: string
  name: string
  phone: string
  vehicle: string
  status: 'Available' | 'On delivery' | 'Returning' | 'Offline'
  x: number
  y: number
  deliveriesToday: number
  rating: number
  activeOrder?: number
  cashInHand: number
}

export const riders: Rider[] = [
  { id: 'rd-1', name: 'Adeel Khan', phone: '+92 300 1212121', vehicle: 'Honda CD-70 · LEB-4412', status: 'On delivery', x: 66, y: 40, deliveriesToday: 9, rating: 4.9, activeOrder: 1051, cashInHand: 42 },
  { id: 'rd-2', name: 'Shahid Iqbal', phone: '+92 301 3434343', vehicle: 'Yamaha YBR · LEC-9081', status: 'On delivery', x: 30, y: 49, deliveriesToday: 7, rating: 4.7, activeOrder: 1049, cashInHand: 18 },
  { id: 'rd-3', name: 'Naveed Anjum', phone: '+92 321 5656565', vehicle: 'Honda 125 · LED-2210', status: 'On delivery', x: 56, y: 54, deliveriesToday: 6, rating: 4.6, activeOrder: 1062, cashInHand: 0 },
  { id: 'rd-4', name: 'Usman Ghani', phone: '+92 333 7878787', vehicle: 'Suzuki GS-150 · LEA-7765', status: 'Available', x: 48, y: 47, deliveriesToday: 8, rating: 4.8, cashInHand: 64 },
  { id: 'rd-5', name: 'Waleed Asif', phone: '+92 345 9090909', vehicle: 'E-bike · EV-0021', status: 'Returning', x: 40, y: 32, deliveriesToday: 5, rating: 4.5, cashInHand: 27 },
  { id: 'rd-6', name: 'Junaid Saleem', phone: '+92 302 1010101', vehicle: 'Honda CD-70 · LEF-3345', status: 'Available', x: 52, y: 52, deliveriesToday: 4, rating: 4.4, cashInHand: 12 },
  { id: 'rd-7', name: 'Faraz Haider', phone: '+92 311 2323232', vehicle: 'Yamaha YBR · LEG-6650', status: 'Offline', x: 10, y: 10, deliveriesToday: 0, rating: 4.3, cashInHand: 0 },
]

export interface DeliveryIntegration {
  id: string
  name: string
  initials: string
  color: string
  connected: boolean
  ordersToday: number
  revenueToday: number
  commission: number
  avgPrepMins: number
  rating: number
  menuSync: boolean
  autoAccept: boolean
  lastSync: string
}

export const integrations: DeliveryIntegration[] = [
  { id: 'foodpanda', name: 'Foodpanda', initials: 'fp', color: '#d70f64', connected: true, ordersToday: 38, revenueToday: 1142, commission: 25, avgPrepMins: 16, rating: 4.6, menuSync: true, autoAccept: true, lastSync: minutesAgo(3) },
  { id: 'careem', name: 'Careem Food', initials: 'C', color: '#1dbf73', connected: true, ordersToday: 21, revenueToday: 688, commission: 22, avgPrepMins: 17, rating: 4.5, menuSync: true, autoAccept: false, lastSync: minutesAgo(8) },
  { id: 'ubereats', name: 'Uber Eats', initials: 'UE', color: '#06c167', connected: true, ordersToday: 12, revenueToday: 402, commission: 30, avgPrepMins: 15, rating: 4.7, menuSync: false, autoAccept: true, lastSync: minutesAgo(41) },
  { id: 'deliveroo', name: 'Deliveroo', initials: 'D', color: '#00ccbc', connected: false, ordersToday: 0, revenueToday: 0, commission: 28, avgPrepMins: 0, rating: 0, menuSync: false, autoAccept: false, lastSync: daysFromNow(-6) },
]

export const deliveryPerformance = [
  { h: '12', orders: 9, onTime: 8 },
  { h: '13', orders: 17, onTime: 15 },
  { h: '14', orders: 12, onTime: 11 },
  { h: '15', orders: 6, onTime: 6 },
  { h: '16', orders: 5, onTime: 5 },
  { h: '17', orders: 8, onTime: 7 },
  { h: '18', orders: 13, onTime: 12 },
  { h: '19', orders: 21, onTime: 18 },
  { h: '20', orders: 26, onTime: 22 },
]

export const getDeliveryZones = () => request<DeliveryZone[]>('/delivery/zones', deliveryZones)
export const saveDeliveryZone = (z: DeliveryZone) => mutate<DeliveryZone>('/delivery/zones', 'POST', z)
export const getDeliveryOrders = () => request<DeliveryOrder[]>('/delivery/orders', deliveryOrders)
export const assignRider = (orderId: string, riderId: string) => mutate(`/delivery/orders/${orderId}/assign`, 'POST', { orderId, riderId })
export const getRiders = () => request<Rider[]>('/delivery/riders', riders)
export const getIntegrations = () => request<DeliveryIntegration[]>('/delivery/integrations', integrations)
export const updateIntegration = (i: DeliveryIntegration) => mutate<DeliveryIntegration>(`/delivery/integrations/${i.id}`, 'PATCH', i)

/* ------------------------------------------------------------------ */
/* Employees & HR                                                      */
/* ------------------------------------------------------------------ */

export const DEPARTMENTS = ['Kitchen', 'Service', 'Delivery', 'Management', 'Cashier', 'Housekeeping'] as const
export type Department = (typeof DEPARTMENTS)[number]

export interface Employee {
  id: string
  code: string
  name: string
  role: string
  department: Department
  branch: Branch
  phone: string
  email: string
  status: 'Active' | 'On leave' | 'Inactive'
  joinedAt: string
  salary: number
  attendance: 'Present' | 'Absent' | 'Late' | 'On leave' | 'Off'
  checkIn?: string
  overtimeHrs: number
  leaveBalance: number
  performance: number
  skills: string[]
}

const emp = (
  n: number,
  name: string,
  role: string,
  department: Department,
  branch: Branch,
  salary: number,
  attendance: Employee['attendance'],
  checkIn: string | undefined,
  overtimeHrs: number,
  performance: number,
  skills: string[],
  joinedDaysAgo: number,
  status: Employee['status'] = attendance === 'On leave' ? 'On leave' : 'Active',
): Employee => ({
  id: `em-${n}`,
  code: `SRK-${String(100 + n)}`,
  name,
  role,
  department,
  branch,
  phone: `+92 3${(n * 7919) % 50 + 10} ${String(1000000 + ((n * 48271) % 8999999)).slice(0, 7)}`,
  email: `${name.split(' ')[0]!.toLowerCase()}@spiceroute.com`,
  status,
  joinedAt: daysFromNow(-joinedDaysAgo),
  salary,
  attendance,
  checkIn,
  overtimeHrs,
  leaveBalance: 14 - (n % 9),
  performance,
  skills,
})

export const employees: Employee[] = [
  emp(1, 'Omar Siddiqui', 'Restaurant Manager', 'Management', 'Downtown', 2400, 'Present', '10:02', 6, 94, ['Operations', 'P&L', 'Hiring'], 1460),
  emp(2, 'Imran Butt', 'Head Chef', 'Kitchen', 'Downtown', 1900, 'Present', '10:45', 12, 91, ['Karahi', 'Biryani', 'Menu R&D'], 1210),
  emp(3, 'Kashif Nawaz', 'Grill Chef', 'Kitchen', 'Downtown', 1150, 'Present', '11:58', 8, 86, ['BBQ', 'Charcoal grill'], 690),
  emp(4, 'Rashid Mehmood', 'Tandoor Specialist', 'Kitchen', 'Downtown', 980, 'Present', '11:50', 4, 88, ['Tandoor', 'Breads'], 820),
  emp(5, 'Sobia Khan', 'Cold Station Cook', 'Kitchen', 'Downtown', 820, 'Late', '12:21', 0, 79, ['Salads', 'Desserts'], 300),
  emp(6, 'Waqas Ali', 'Bartender', 'Kitchen', 'Downtown', 760, 'Present', '15:55', 3, 83, ['Mocktails', 'Barista'], 410),
  emp(7, 'Hamza Riaz', 'Senior Waiter', 'Service', 'Downtown', 720, 'Present', '15:58', 9, 92, ['Upselling', 'VIP service'], 950),
  emp(8, 'Ali Raza', 'Waiter', 'Service', 'Downtown', 620, 'Present', '16:02', 5, 85, ['Table service'], 380),
  emp(9, 'Zainab Iqbal', 'Floor Supervisor', 'Service', 'Downtown', 980, 'Present', '15:50', 7, 90, ['Guest relations', 'Training'], 1100),
  emp(10, 'Sadia Pervez', 'Hostess', 'Service', 'Downtown', 640, 'Present', '16:10', 2, 87, ['Reservations', 'Guest relations'], 260),
  emp(11, 'Bilal Ahmed', 'Cashier', 'Cashier', 'Downtown', 700, 'Present', '11:55', 1, 84, ['POS', 'Cash handling'], 540),
  emp(12, 'Adeel Khan', 'Delivery Rider', 'Delivery', 'Downtown', 520, 'Present', '12:00', 10, 93, ['Navigation'], 480),
  emp(13, 'Shahid Iqbal', 'Delivery Rider', 'Delivery', 'Downtown', 500, 'Present', '12:05', 6, 85, ['Navigation'], 210),
  emp(14, 'Usman Ghani', 'Delivery Rider', 'Delivery', 'Downtown', 500, 'Present', '15:59', 4, 88, ['Navigation'], 160),
  emp(15, 'Tariq Mehmood', 'Store Keeper', 'Management', 'Downtown', 880, 'Present', '09:30', 0, 82, ['Inventory', 'GRN'], 1300),
  emp(16, 'Nauman Aslam', 'Asst. Manager', 'Management', 'Mall Road', 1500, 'Present', '10:15', 5, 89, ['Operations', 'Scheduling'], 700),
  emp(17, 'Kiran Javed', 'Waitress', 'Service', 'Mall Road', 620, 'On leave', undefined, 0, 81, ['Table service'], 230),
  emp(18, 'Fahad Mustafa', 'Line Cook', 'Kitchen', 'Mall Road', 780, 'Absent', undefined, 0, 72, ['Wok', 'Fryer'], 150),
  emp(19, 'Mehreen Shah', 'Cashier', 'Cashier', 'Airport', 700, 'Present', '06:00', 3, 86, ['POS'], 330),
  emp(20, 'Asif Rana', 'Sous Chef', 'Kitchen', 'Airport', 1400, 'Present', '05:50', 11, 90, ['Continental', 'Pasta'], 640),
  emp(21, 'Nida Farooq', 'Housekeeping', 'Housekeeping', 'Downtown', 450, 'Present', '09:00', 0, 80, ['Sanitation'], 420),
  emp(22, 'Javed Akhtar', 'Dishwasher', 'Housekeeping', 'Mall Road', 420, 'Off', undefined, 0, 77, ['Sanitation'], 90),
]

export type ShiftType = 'Morning' | 'Evening' | 'Night' | 'Split' | 'Off' | 'Leave'
export const SHIFT_TIMES: Record<ShiftType, string> = {
  Morning: '08:00–16:00',
  Evening: '16:00–00:00',
  Night: '22:00–06:00',
  Split: '12:00–15:00, 19:00–23:00',
  Off: '—',
  Leave: '—',
}
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface ShiftRow {
  employeeId: string
  shifts: ShiftType[]
}

const patterns: ShiftType[][] = [
  ['Morning', 'Morning', 'Morning', 'Morning', 'Morning', 'Off', 'Off'],
  ['Evening', 'Evening', 'Off', 'Evening', 'Evening', 'Evening', 'Evening'],
  ['Split', 'Split', 'Split', 'Off', 'Split', 'Split', 'Split'],
  ['Off', 'Evening', 'Evening', 'Evening', 'Evening', 'Evening', 'Off'],
  ['Morning', 'Off', 'Morning', 'Morning', 'Evening', 'Evening', 'Evening'],
  ['Evening', 'Evening', 'Evening', 'Off', 'Off', 'Evening', 'Evening'],
]

export const shiftSchedule: ShiftRow[] = employees.map((e, i) => ({
  employeeId: e.id,
  shifts: e.status === 'On leave' ? WEEK_DAYS.map(() => 'Leave' as ShiftType) : patterns[i % patterns.length]!,
}))

export interface LeaveRequest {
  id: string
  employee: string
  type: 'Annual' | 'Sick' | 'Casual' | 'Unpaid'
  from: string
  to: string
  days: number
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
}

export const leaveRequests: LeaveRequest[] = [
  { id: 'lv-1', employee: 'Kiran Javed', type: 'Annual', from: daysFromNow(-2), to: daysFromNow(4), days: 7, reason: 'Family wedding in Multan', status: 'Approved' },
  { id: 'lv-2', employee: 'Ali Raza', type: 'Casual', from: daysFromNow(3), to: daysFromNow(3), days: 1, reason: 'University exam', status: 'Pending' },
  { id: 'lv-3', employee: 'Sobia Khan', type: 'Sick', from: daysFromNow(1), to: daysFromNow(2), days: 2, reason: 'Medical appointment', status: 'Pending' },
  { id: 'lv-4', employee: 'Kashif Nawaz', type: 'Annual', from: daysFromNow(12), to: daysFromNow(18), days: 7, reason: 'Umrah', status: 'Pending' },
  { id: 'lv-5', employee: 'Shahid Iqbal', type: 'Unpaid', from: daysFromNow(-20), to: daysFromNow(-19), days: 2, reason: 'Personal', status: 'Rejected' },
  { id: 'lv-6', employee: 'Hamza Riaz', type: 'Casual', from: daysFromNow(-9), to: daysFromNow(-9), days: 1, reason: 'Bike repair', status: 'Approved' },
]

export interface HrTask {
  id: string
  title: string
  department: Department
  assignee: string
  due: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'In progress' | 'Completed'
}

export const hrTasks: HrTask[] = [
  { id: 'tk-1', title: 'Deep-clean tandoor & exhaust hood', department: 'Kitchen', assignee: 'Rashid Mehmood', due: daysFromNow(0), priority: 'High', status: 'In progress' },
  { id: 'tk-2', title: 'Prep 40 portions biryani marinade', department: 'Kitchen', assignee: 'Imran Butt', due: daysFromNow(0), priority: 'High', status: 'Open' },
  { id: 'tk-3', title: 'Re-arrange terrace for birthday (Malik party)', department: 'Service', assignee: 'Zainab Iqbal', due: daysFromNow(0), priority: 'Medium', status: 'Open' },
  { id: 'tk-4', title: 'Cash drawer reconciliation – lunch shift', department: 'Cashier', assignee: 'Bilal Ahmed', due: daysFromNow(0), priority: 'Medium', status: 'Completed' },
  { id: 'tk-5', title: 'Weekly stock count – dry store', department: 'Management', assignee: 'Tariq Mehmood', due: daysFromNow(1), priority: 'Medium', status: 'Open' },
  { id: 'tk-6', title: 'Bike servicing – LEB-4412', department: 'Delivery', assignee: 'Adeel Khan', due: daysFromNow(2), priority: 'Low', status: 'Open' },
  { id: 'tk-7', title: 'Sanitise washrooms (hourly log)', department: 'Housekeeping', assignee: 'Nida Farooq', due: daysFromNow(0), priority: 'High', status: 'In progress' },
  { id: 'tk-8', title: 'Onboard 2 new waiters', department: 'Management', assignee: 'Omar Siddiqui', due: daysFromNow(4), priority: 'Medium', status: 'Open' },
]

export interface TrainingRecord {
  id: string
  employee: string
  course: string
  progress: number
  due: string
  mandatory: boolean
}

export const trainings: TrainingRecord[] = [
  { id: 'tr-1', employee: 'Ali Raza', course: 'Upselling & Menu Knowledge', progress: 60, due: daysFromNow(7), mandatory: false },
  { id: 'tr-2', employee: 'Sobia Khan', course: 'Food Safety Level 2 (HACCP)', progress: 35, due: daysFromNow(5), mandatory: true },
  { id: 'tr-3', employee: 'Fahad Mustafa', course: 'Food Safety Level 2 (HACCP)', progress: 10, due: daysFromNow(3), mandatory: true },
  { id: 'tr-4', employee: 'Sadia Pervez', course: 'Reservation System & Guest CRM', progress: 100, due: daysFromNow(-4), mandatory: false },
  { id: 'tr-5', employee: 'Shahid Iqbal', course: 'Defensive Riding & Road Safety', progress: 80, due: daysFromNow(10), mandatory: true },
  { id: 'tr-6', employee: 'Bilal Ahmed', course: 'POS Refunds & Fraud Prevention', progress: 100, due: daysFromNow(-12), mandatory: true },
  { id: 'tr-7', employee: 'Kashif Nawaz', course: 'Advanced Grilling Techniques', progress: 45, due: daysFromNow(20), mandatory: false },
]

export const staffingForecast = [
  { day: 'Mon', scheduled: 16, recommended: 15, covers: 210 },
  { day: 'Tue', scheduled: 16, recommended: 15, covers: 198 },
  { day: 'Wed', scheduled: 15, recommended: 16, covers: 236 },
  { day: 'Thu', scheduled: 16, recommended: 17, covers: 262 },
  { day: 'Fri', scheduled: 18, recommended: 21, covers: 348 },
  { day: 'Sat', scheduled: 19, recommended: 22, covers: 392 },
  { day: 'Sun', scheduled: 18, recommended: 20, covers: 365 },
]

export const getEmployees = () => request<Employee[]>('/hr/employees', employees)
export const saveEmployee = (e: Employee) => mutate<Employee>('/hr/employees', 'POST', e)
export const getShiftSchedule = () => request<ShiftRow[]>('/hr/shifts', shiftSchedule)
export const saveShiftSchedule = (rows: ShiftRow[]) => mutate<ShiftRow[]>('/hr/shifts', 'PUT', rows)
export const getLeaveRequests = () => request<LeaveRequest[]>('/hr/leave', leaveRequests)
export const updateLeaveRequest = (l: LeaveRequest) => mutate<LeaveRequest>(`/hr/leave/${l.id}`, 'PATCH', l)
export const getHrTasks = () => request<HrTask[]>('/hr/tasks', hrTasks)
export const getTrainings = () => request<TrainingRecord[]>('/hr/training', trainings)

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardSummary {
  sales: number
  salesDelta: number
  orders: number
  ordersDelta: number
  covers: number
  coversDelta: number
  avgTicket: number
  avgTicketDelta: number
  salesByHour: { h: string; today: number; lastWeek: number }[]
  channelMix: { name: string; value: number }[]
}

const branchFactor: Record<string, number> = { 'All branches': 1, Downtown: 0.46, 'Mall Road': 0.34, Airport: 0.2 }

const baseHours: [string, number, number][] = [
  ['11', 180, 160], ['12', 640, 590], ['13', 1180, 1090], ['14', 920, 870], ['15', 410, 450], ['16', 360, 340],
  ['17', 520, 480], ['18', 880, 810], ['19', 1460, 1320], ['20', 1720, 1590], ['21', 1380, 1410], ['22', 760, 690],
]

export function dashboardSummary(branch: string): DashboardSummary {
  const f = branchFactor[branch] ?? 1
  const salesByHour = baseHours.map(([h, t, l]) => ({ h: `${h}:00`, today: Math.round(t * f * 2.2), lastWeek: Math.round(l * f * 2.2) }))
  const sales = salesByHour.reduce((s, x) => s + x.today, 0)
  const orders = Math.round(612 * f)
  return {
    sales,
    salesDelta: 8.4,
    orders,
    ordersDelta: 5.1,
    covers: Math.round(1184 * f),
    coversDelta: 3.6,
    avgTicket: +(sales / orders).toFixed(2),
    avgTicketDelta: 3.2,
    salesByHour,
    channelMix: [
      { name: 'Dine-in', value: 46 },
      { name: 'Takeaway', value: 14 },
      { name: 'Own delivery', value: 15 },
      { name: 'Foodpanda', value: 14 },
      { name: 'Careem', value: 7 },
      { name: 'Uber Eats', value: 4 },
    ],
  }
}

export const getDashboardSummary = (branch: string) => request<DashboardSummary>(`/dashboard/summary?branch=${encodeURIComponent(branch)}`, dashboardSummary(branch))

/* ------------------------------------------------------------------ */
/* AI insights per module (Central AI engine)                          */
/* ------------------------------------------------------------------ */

export type AIModule = 'dashboard' | 'pos' | 'kitchen' | 'menu' | 'tables' | 'inventory' | 'delivery' | 'employees'

export const aiInsights: Record<AIModule, AIInsight[]> = {
  dashboard: [
    { title: 'Dinner rush forecast: +22% covers tonight', detail: 'Cricket match + Friday payday. Expect peak at 20:30. Add 2 servers and 1 wok cook from 19:00.', severity: 'opportunity', metric: '92% confidence', action: 'Open smart schedule' },
    { title: 'Basmati rice will run out by 21:15', detail: 'Only 6 kg left vs. 14 kg forecast consumption. Transfer 20 kg from Mall Road or raise a PO with Guard Rice Mills.', severity: 'critical', metric: '-2h 10m', action: 'Reorder now' },
    { title: 'Wok station overloaded', detail: 'Wok is at 100% capacity with avg prep 17.8 min vs 15 target. Re-route Alfredo Pasta to Grill backup.', severity: 'warning', metric: '+19% delay', action: 'View KDS' },
    { title: 'Raise Mutton Karahi price by $1.50', detail: 'Demand is inelastic; mutton cost up 9% this month. Margin recovers to 58% with minimal volume impact.', severity: 'opportunity', metric: '+$410/wk', action: 'Review pricing' },
    { title: '2 reservations at high no-show risk', detail: 'Junaid Akram (63%) and Sara Ahmed (41%). Send WhatsApp confirmation and release tables at +15 min.', severity: 'info', action: 'Send reminders' },
  ],
  pos: [
    { title: 'Predicted next 30 min: 41 orders', detail: '62% dine-in. Pre-fire 12 Garlic Naan and 6 Chicken Biryani to cut wait by ~3 min.', severity: 'opportunity', metric: '88% confidence', action: 'Pre-fire items' },
    { title: 'Prioritise #1054 (Careem)', detail: 'Rider arrives in 4 min and the order is at risk of breaching platform SLA. Bumped to Rush.', severity: 'warning', metric: 'SLA risk', action: 'Prioritise' },
    { title: 'Upsell suggestion: Mint Margarita', detail: 'Guests ordering Karahi add a Mint Margarita 38% of the time when suggested by staff.', severity: 'info', metric: '+$2.90 avg ticket' },
    { title: 'Refund anomaly detected', detail: 'Two refunds on the same terminal within 30 min by one cashier. Flagged for manager review.', severity: 'critical', action: 'Review refunds' },
  ],
  kitchen: [
    { title: 'Ticket #1053 will be 6 min late', detail: 'Lamb chops + full Mutton Karahi on a saturated Wok station. Start chops now and notify server.', severity: 'warning', metric: 'ETA 34 min', action: 'Notify server' },
    { title: 'Move 3 items from Wok to Grill', detail: 'Grill has 25% spare capacity. Shifting Alfredo Pasta finishing reduces Wok queue by 4.5 min.', severity: 'opportunity', metric: '-4.5 min', action: 'Rebalance' },
    { title: 'Peak workload expected 20:00–21:30', detail: 'Predicted 46 tickets/hour. Batch-cook biryani now (40 portions) and pre-skewer 60 seekh.', severity: 'info', metric: '46 tickets/h' },
    { title: 'Remake rate up at Wok station', detail: '2 remakes today (salt, split sauce). Recommend a quick taste-check before pass for creamy dishes.', severity: 'critical', metric: '4.1% remakes' },
  ],
  menu: [
    { title: 'Mutton Biryani is a Star – feature it', detail: 'High margin & popularity. Put it in the hero slot on the online menu and in the lunch combo.', severity: 'success', metric: '62% margin' },
    { title: 'Palak Paneer is a Dog', detail: 'Low popularity (41/wk) and below-average margin. Consider removing or reworking into a combo.', severity: 'warning', action: 'Rework item' },
    { title: 'Reprice Chicken Karahi Full: $28.50 → $29.90', detail: 'Elasticity model shows <2% volume drop; competitor median is $31.', severity: 'opportunity', metric: '+$380/wk', action: 'Apply price' },
    { title: 'Lamb Chops is a Puzzle', detail: 'Great margin but low volume. Add to BBQ platter and train servers to recommend it.', severity: 'info', metric: '64 sold/wk' },
  ],
  tables: [
    { title: 'Junaid Akram – 63% no-show risk', detail: 'New guest, booked via online widget, no confirmation reply. Hold T8 only until +10 min.', severity: 'warning', metric: '63%', action: 'Send reminder' },
    { title: 'Seat waiting party of 2 at T10 now', detail: 'Rizwan Akhtar has waited 14 min; T10 matches size and will be free for 70 min before next booking.', severity: 'opportunity', action: 'Seat guest' },
    { title: 'T2 likely to free up in ~8 min', detail: 'Bill requested pattern + dessert served. Pre-assign to Mahnoor Iqbal (party of 4).', severity: 'info', metric: '86% confidence' },
    { title: 'Combine T5 + T10 for Tahir family (7)', detail: 'Family hall is full till 21:10. Combining Main Hall 2-tops creates an 8-seater 25 min earlier.', severity: 'opportunity', action: 'Combine tables' },
  ],
  inventory: [
    { title: 'Reorder Basmati Rice today', detail: 'Forecast use 44 kg over the weekend; 6 kg on hand. Suggested PO: 100 kg from Guard Rice Mills.', severity: 'critical', metric: '0.3 days cover', action: 'Create PO' },
    { title: 'Coriander likely to spoil tomorrow', detail: '0.8 kg expiring in 24h. Use in tonight’s chutney batch or transfer to Mall Road.', severity: 'warning', metric: '78% spoilage risk' },
    { title: 'Weekend chicken demand +28%', detail: 'Saturday forecast 44 kg vs 31 kg weekday average. Increase K&N standing order for Fri/Sat.', severity: 'opportunity', metric: '44 kg' },
    { title: 'Cooking cream wastage trend', detail: '3 wastage events this month. Reduce par from 18 L to 12 L and order twice weekly.', severity: 'info', metric: '-$48/mo', action: 'Adjust par' },
  ],
  delivery: [
    { title: 'Batch #1054 + #1062 with Naveed', detail: 'Both orders go to DHA/Askari (Zone C) within 1.2 km. Batching saves 11 min and one rider trip.', severity: 'opportunity', metric: '-11 min', action: 'Batch orders' },
    { title: 'ETA risk on Careem #1054', detail: 'Traffic on Main Boulevard +35%. Updated AI ETA 49 min vs 45 promised – notify customer.', severity: 'warning', metric: '+4 min', action: 'Notify customer' },
    { title: 'Add 2 riders 19:30–21:30', detail: 'Forecast 26 delivery orders/hour at peak with current 4 active riders → avg wait 9 min.', severity: 'info', metric: '26 orders/h' },
    { title: 'Turn on Deliveroo', detail: 'Similar restaurants in your area earn ~$310/day extra on Deliveroo with 28% commission.', severity: 'opportunity', metric: '+$310/day', action: 'Connect' },
  ],
  employees: [
    { title: 'Understaffed Fri & Sat evening', detail: 'Forecast 348–392 covers. Add 3 servers and 1 line cook to the evening shift.', severity: 'warning', metric: '-3 staff', action: 'Auto-fill shifts' },
    { title: 'Overtime cost rising', detail: 'Imran Butt (12h) and Asif Rana (11h) exceed 10h OT this period. Redistribute to Kashif & Fahad.', severity: 'critical', metric: '+$186 OT' },
    { title: 'Fahad Mustafa attrition risk', detail: '3 absences in 2 weeks and low performance score. Schedule 1:1 with Assistant Manager.', severity: 'info', metric: '71% risk' },
    { title: 'Hamza Riaz – promotion ready', detail: 'Top performer (92) with highest upsell rate. Recommend Floor Supervisor track.', severity: 'success' },
  ],
}

export const getAIInsights = (module: AIModule) => request<AIInsight[]>(`/ai/insights?module=${module}`, aiInsights[module])
