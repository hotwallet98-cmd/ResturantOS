/**
 * Demo data for "Spice Route Kitchen", ported from the web prototype
 * (Frontend/src/shared/services/operations.ts + auth.ts + flow.ts seed()).
 */
import type { FloorArea, FlowStatus, MenuItem, Reservation, Role, Station, TableStatus } from '@restaurantos/contracts'

export const RESTAURANT = { id: 'r-001', slug: 'spice-route', name: 'Spice Route Kitchen', branches: ['Downtown', 'Mall Road', 'Airport'], plan: 'Free' as const }

const minutesAgo = (mins: number) => new Date(Date.now() - mins * 60_000)
const inMins = (mins: number) => new Date(Date.now() + mins * 60_000)

/* Menu ---------------------------------------------------------------- */

const m = (
  id: string,
  name: string,
  emoji: string,
  category: string,
  price: number,
  station: Station,
  prepMins: number,
  extra: Partial<MenuItem> = {},
): MenuItem => ({ id, name, emoji, category, price, station, prepMins, description: '', veg: false, available: true, variants: [], ...extra })

export const menuItems: MenuItem[] = [
  m('mi-01', 'Chicken Tikka Boti', '🍢', 'Starters', 8.5, 'Grill', 14, { description: 'Char-grilled boneless chicken in house tikka marinade' }),
  m('mi-02', 'Paneer Tikka', '🧀', 'Starters', 7.9, 'Tandoor', 12, { veg: true, description: 'Cottage cheese, peppers & onion, tandoor roasted' }),
  m('mi-03', 'Chicken Wings (8 pc)', '🍗', 'Starters', 7.5, 'Wok', 10, { variants: [{ name: 'Buffalo', price: 0 }, { name: 'Honey Garlic', price: 0 }, { name: 'Peri Peri', price: 0.5 }] }),
  m('mi-04', 'Dahi Puri Chaat', '🥣', 'Starters', 5.5, 'Cold', 6, { veg: true }),
  m('mi-05', 'Seekh Kebab (4 pc)', '🥙', 'BBQ & Grill', 9.9, 'Grill', 15, { description: 'Minced beef skewers with green chilli & coriander', variants: [{ name: 'Beef', price: 0 }, { name: 'Chicken', price: -0.5 }, { name: 'Mutton', price: 1.5 }] }),
  m('mi-06', 'Malai Boti', '🍖', 'BBQ & Grill', 10.5, 'Grill', 16, { description: 'Creamy cardamom-marinated chicken cubes' }),
  m('mi-07', 'Lamb Chops (4 pc)', '🥩', 'BBQ & Grill', 18.9, 'Grill', 20, { description: 'Marinated in raw papaya & garam masala' }),
  m('mi-08', 'Tandoori Chicken (Half)', '🍗', 'BBQ & Grill', 11.5, 'Tandoor', 22, { variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 8 }] }),
  m('mi-09', 'Chicken Karahi', '🍲', 'Karahi & Curries', 16.5, 'Wok', 20, { description: 'Wok-cooked with tomatoes, ginger & green chillies', variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 12 }] }),
  m('mi-10', 'Mutton Karahi', '🥘', 'Karahi & Curries', 22.0, 'Wok', 28, { variants: [{ name: 'Half', price: 0 }, { name: 'Full', price: 16 }] }),
  m('mi-11', 'Butter Chicken', '🍛', 'Karahi & Curries', 14.5, 'Wok', 16),
  m('mi-12', 'Daal Makhani', '🫘', 'Karahi & Curries', 9.5, 'Wok', 10, { veg: true }),
  m('mi-13', 'Palak Paneer', '🥬', 'Karahi & Curries', 10.5, 'Wok', 12, { veg: true }),
  m('mi-14', 'Mutton Biryani', '🍚', 'Rice & Biryani', 13.9, 'Wok', 8, { description: 'Dum-cooked basmati with tender mutton & saffron' }),
  m('mi-15', 'Chicken Biryani', '🍛', 'Rice & Biryani', 11.5, 'Wok', 8),
  m('mi-16', 'Vegetable Pulao', '🍚', 'Rice & Biryani', 8.0, 'Wok', 8, { veg: true }),
  m('mi-17', 'Garlic Naan', '🫓', 'Breads', 2.5, 'Tandoor', 4, { veg: true }),
  m('mi-18', 'Butter Naan', '🫓', 'Breads', 2.0, 'Tandoor', 4, { veg: true }),
  m('mi-19', 'Roghni Naan', '🫓', 'Breads', 2.5, 'Tandoor', 5, { veg: true }),
  m('mi-20', 'Zinger Burger', '🍔', 'Burgers & Wraps', 8.9, 'Grill', 9),
  m('mi-21', 'Smash Beef Burger', '🍔', 'Burgers & Wraps', 10.9, 'Grill', 10),
  m('mi-22', 'Chicken Shawarma Wrap', '🌯', 'Burgers & Wraps', 6.9, 'Grill', 7),
  m('mi-23', 'Alfredo Pasta', '🍝', 'Pasta & Continental', 12.5, 'Wok', 13, { variants: [{ name: 'Chicken', price: 0 }, { name: 'Mushroom', price: -1 }, { name: 'Prawns', price: 3 }] }),
  m('mi-24', 'Grilled Chicken Steak', '🍽️', 'Pasta & Continental', 15.9, 'Grill', 18, { variants: [{ name: 'Mushroom sauce', price: 0 }, { name: 'Pepper sauce', price: 0 }] }),
  m('mi-25', 'Caesar Salad', '🥗', 'Pasta & Continental', 8.5, 'Cold', 6),
  m('mi-26', 'Kheer', '🍮', 'Desserts', 4.5, 'Cold', 2, { veg: true }),
  m('mi-27', 'Gulab Jamun (2 pc)', '🟤', 'Desserts', 3.9, 'Cold', 2, { veg: true }),
  m('mi-28', 'Molten Lava Cake', '🍫', 'Desserts', 6.5, 'Cold', 8, { veg: true }),
  m('mi-29', 'Mint Margarita', '🍹', 'Beverages', 3.9, 'Drinks', 3, { veg: true }),
  m('mi-30', 'Mango Lassi', '🥭', 'Beverages', 4.2, 'Drinks', 3, { veg: true }),
  m('mi-31', 'Doodh Patti Chai', '☕', 'Beverages', 2.2, 'Drinks', 4, { veg: true, variants: [{ name: 'Regular', price: 0 }, { name: 'Karak', price: 0.3 }] }),
  m('mi-32', 'Soft Drink', '🥤', 'Beverages', 1.8, 'Drinks', 1, { veg: true, variants: [{ name: 'Can', price: 0 }, { name: '1.5L', price: 1.7 }] }),
  m('mi-33', 'Fresh Lime Soda', '🍋', 'Beverages', 3.2, 'Drinks', 2, { veg: true, available: false }),
]

/* Tables -------------------------------------------------------------- */

interface SeedTable {
  id: string
  area: FloorArea
  seats: number
  shape: 'round' | 'square' | 'rect'
  col: number
  row: number
  status: TableStatus
  guests?: number
  guestName?: string
  server?: string
  seatedAt?: Date
  billTotal?: number
  reservedFor?: string
}
const tb = (id: string, area: FloorArea, seats: number, shape: SeedTable['shape'], col: number, row: number, status: TableStatus, extra: Partial<SeedTable> = {}): SeedTable => ({
  id,
  area,
  seats,
  shape,
  col,
  row,
  status,
  ...extra,
})

export const tables: SeedTable[] = [
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

/* Reservations -------------------------------------------------------- */

type SeedReservation = Omit<Reservation, 'time'> & { time: Date }
export const reservations: SeedReservation[] = [
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

/* Riders (prototype "Returning" maps to "On delivery", as in flow.ts) ---- */

export const riders = [
  { id: 'rd-1', name: 'Adeel Khan', phone: '+92 300 1212121', vehicle: 'Honda CD-70 · LEB-4412', status: 'On delivery' },
  { id: 'rd-2', name: 'Shahid Iqbal', phone: '+92 301 3434343', vehicle: 'Yamaha YBR · LEC-9081', status: 'On delivery' },
  { id: 'rd-3', name: 'Naveed Anjum', phone: '+92 321 5656565', vehicle: 'Honda 125 · LED-2210', status: 'On delivery' },
  { id: 'rd-4', name: 'Usman Ghani', phone: '+92 333 7878787', vehicle: 'Suzuki GS-150 · LEA-7765', status: 'Available' },
  { id: 'rd-5', name: 'Waleed Asif', phone: '+92 345 9090909', vehicle: 'E-bike · EV-0021', status: 'On delivery' },
  { id: 'rd-6', name: 'Junaid Saleem', phone: '+92 302 1010101', vehicle: 'Honda CD-70 · LEF-3345', status: 'Available' },
  { id: 'rd-7', name: 'Faraz Haider', phone: '+92 311 2323232', vehicle: 'Yamaha YBR · LEG-6650', status: 'Offline' },
] as const

/* Users (demo logins; any password, any 6-digit MFA code) -------------- */

export const users: { id: string; name: string; email: string; role: Role; title: string; restaurant: boolean; riderId?: string }[] = [
  { id: 'u-001', name: 'Ayesha Khan', email: 'ayesha@restaurantos.io', role: 'super_admin', title: 'Platform Super Admin', restaurant: false },
  { id: 'u-101', name: 'Omar Siddiqui', email: 'omar@spiceroute.com', role: 'restaurant_admin', title: 'Restaurant Admin', restaurant: true },
  { id: 'u-201', name: 'Imran Butt', email: 'imran.kitchen@spiceroute.com', role: 'kitchen_staff', title: 'Head Chef', restaurant: true },
  { id: 'u-301', name: 'Sadia Pervez', email: 'sadia.counter@spiceroute.com', role: 'counter_staff', title: 'Counter / Cashier', restaurant: true },
  { id: 'u-401', name: 'Hamza Riaz', email: 'hamza.floor@spiceroute.com', role: 'waiter', title: 'Waiter', restaurant: true },
  { id: 'rd-4', name: 'Usman Ghani', email: 'usman.rider@spiceroute.com', role: 'rider', title: 'Delivery Rider', restaurant: true, riderId: 'rd-4' },
]

/* Live orders (prototype kitchen tickets) ------------------------------ */

interface SeedLine {
  itemId: string
  qty: number
  modifiers?: string[]
  notes?: string
  done?: boolean
}
const ti = (itemId: string, qty: number, modifiers: string[] = [], notes?: string, done = false): SeedLine => ({ itemId, qty, modifiers, notes, done })

export interface SeedOrder {
  id: string
  orderNo: number
  type: 'Dine-in' | 'Takeaway' | 'Delivery'
  table?: string
  fromPos: boolean
  server: string
  status: FlowStatus
  priority: 'Normal' | 'High' | 'Rush'
  createdAt: Date
  predictedMins: number
  remake?: boolean
  items: SeedLine[]
}

export const orders: SeedOrder[] = [
  { id: 'kt-1', orderNo: 1058, type: 'Dine-in', table: 'T4', fromPos: true, server: 'Hamza Riaz', status: 'Received', priority: 'Normal', createdAt: minutesAgo(1.5), predictedMins: 22, items: [ti('mi-09', 1, ['Full'], 'Less oil'), ti('mi-17', 4), ti('mi-29', 3)] },
  { id: 'kt-2', orderNo: 1057, type: 'Delivery', fromPos: false, server: 'Online', status: 'Received', priority: 'High', createdAt: minutesAgo(3), predictedMins: 12, items: [ti('mi-14', 2, [], 'Extra raita'), ti('mi-26', 2)] },
  { id: 'kt-3', orderNo: 1059, type: 'Takeaway', fromPos: false, server: 'Online', status: 'Received', priority: 'Normal', createdAt: minutesAgo(0.5), predictedMins: 10, items: [ti('mi-22', 2), ti('mi-03', 1, ['Honey Garlic']), ti('mi-32', 2)] },
  { id: 'kt-4', orderNo: 1056, type: 'Takeaway', fromPos: true, server: 'Sadia Pervez', status: 'Preparing', priority: 'Normal', createdAt: minutesAgo(6), predictedMins: 9, items: [ti('mi-20', 2, ['Cheese slice', 'Meal'], undefined, true), ti('mi-32', 2, [], undefined, true)] },
  { id: 'kt-5', orderNo: 1055, type: 'Dine-in', table: 'T9', fromPos: true, server: 'Ali Raza', status: 'Preparing', priority: 'Normal', createdAt: minutesAgo(9), predictedMins: 16, items: [ti('mi-05', 2, ['Beef'], undefined, true), ti('mi-06', 1), ti('mi-18', 3), ti('mi-30', 2, [], undefined, true)] },
  { id: 'kt-6', orderNo: 1054, type: 'Delivery', fromPos: false, server: 'Online', status: 'Preparing', priority: 'Rush', createdAt: minutesAgo(11), predictedMins: 13, items: [ti('mi-23', 1, ['Chicken']), ti('mi-25', 1, ['Grilled chicken'], undefined, true)] },
  { id: 'kt-7', orderNo: 1053, type: 'Dine-in', table: 'V1', fromPos: true, server: 'Hamza Riaz', status: 'Preparing', priority: 'High', createdAt: minutesAgo(19), predictedMins: 28, items: [ti('mi-07', 2, [], 'Medium well'), ti('mi-10', 1, ['Full']), ti('mi-19', 4), ti('mi-28', 2)] },
  { id: 'kt-8', orderNo: 1052, type: 'Takeaway', fromPos: false, server: 'Online', status: 'Ready', priority: 'Normal', createdAt: minutesAgo(15), predictedMins: 10, items: [ti('mi-15', 3, [], undefined, true), ti('mi-32', 3, [], undefined, true)] },
  { id: 'kt-9', orderNo: 1060, type: 'Dine-in', table: 'T6', fromPos: true, server: 'Zainab Iqbal', status: 'Ready', priority: 'Normal', createdAt: minutesAgo(17), predictedMins: 14, remake: true, items: [ti('mi-11', 1, [], 'Remake – too salty', true), ti('mi-17', 2, [], undefined, true)] },
  { id: 'kt-10', orderNo: 1050, type: 'Dine-in', table: 'T2', fromPos: true, server: 'Ali Raza', status: 'Served', priority: 'Normal', createdAt: minutesAgo(28), predictedMins: 20, items: [ti('mi-01', 1, [], undefined, true), ti('mi-08', 1, ['Full'], undefined, true), ti('mi-17', 2, [], undefined, true)] },
  { id: 'kt-11', orderNo: 1048, type: 'Dine-in', table: 'F3', fromPos: true, server: 'Zainab Iqbal', status: 'Served', priority: 'Normal', createdAt: minutesAgo(36), predictedMins: 18, items: [ti('mi-14', 2, [], undefined, true), ti('mi-09', 1, ['Half'], undefined, true)] },
]
