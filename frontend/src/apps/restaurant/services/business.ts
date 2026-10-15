/**
 * Business-side services for the restaurant portal:
 * Suppliers & Procurement, Customers & Loyalty, Online Menu, Social Media,
 * Finance, Compliance, Reports/BI and the Central AI & Automation Engine.
 *
 * Every function goes through `request()` / `mutate()` so a real backend can be
 * plugged in later without touching page components.
 */
import { mutate, request } from '@/shared/services/client'
import { daysFromNow, minutesAgo } from '@/shared/lib/format'

export const BRANCHES = ['Downtown', 'Mall Road', 'Airport'] as const
export type Branch = (typeof BRANCHES)[number]

/* ════════════════════════════ Suppliers & Procurement ════════════════════════════ */

export interface Supplier {
  id: string
  name: string
  emoji: string
  category: string
  contact: string
  phone: string
  email: string
  city: string
  paymentTerms: string
  status: 'Active' | 'Pending' | 'Inactive'
  rating: number
  onTimePct: number
  qualityScore: number
  priceIndex: number // 100 = market average; lower is cheaper
  spendYtd: number
  balanceDue: number
  leadTimeDays: number
}

export interface PurchaseRequest {
  id: string
  item: string
  qty: number
  unit: string
  estCost: number
  branch: Branch
  requestedBy: string
  reason: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status: 'Pending' | 'Approved' | 'Rejected'
  createdAt: string
  aiGenerated?: boolean
}

export type POStatus = 'Draft' | 'Sent' | 'Confirmed' | 'In Transit' | 'Received' | 'Cancelled'
export const PO_STAGES: POStatus[] = ['Draft', 'Sent', 'Confirmed', 'In Transit', 'Received']

export interface POLine {
  item: string
  qty: number
  unit: string
  unitPrice: number
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  supplier: string
  branch: Branch
  lines: POLine[]
  total: number
  status: POStatus
  createdAt: string
  expectedAt: string
  history: { status: POStatus; at: string; by: string }[]
}

export interface GoodsReceipt {
  id: string
  poId: string
  supplier: string
  branch: Branch
  item: string
  orderedQty: number
  acceptedQty: number
  rejectedQty: number
  unit: string
  tempOk: boolean
  inspector: string
  notes: string
  status: 'Passed' | 'Partial' | 'Failed' | 'Pending'
  receivedAt: string
}

export interface SupplierPayment {
  id: string
  supplier: string
  invoice: string
  amount: number
  dueDate: string
  method: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Card'
  status: 'Paid' | 'Due' | 'Overdue' | 'Scheduled'
}

export interface SupplierReturn {
  id: string
  supplier: string
  item: string
  qty: number
  unit: string
  reason: string
  credit: number
  status: 'Pending' | 'Approved' | 'Resolved' | 'Rejected'
  createdAt: string
}

const suppliers: Supplier[] = [
  { id: 'SUP-101', name: 'Metro Foods', emoji: '🏬', category: 'Dry Goods & Grocery', contact: 'Imran Siddiqui', phone: '+92 300 4412 889', email: 'orders@metrofoods.pk', city: 'Lahore', paymentTerms: 'Net 30', status: 'Active', rating: 4.6, onTimePct: 96, qualityScore: 92, priceIndex: 97, spendYtd: 48250, balanceDue: 3240, leadTimeDays: 2 },
  { id: 'SUP-102', name: 'Dairy Fresh', emoji: '🥛', category: 'Dairy & Eggs', contact: 'Ayesha Khan', phone: '+92 321 7781 220', email: 'sales@dairyfresh.pk', city: 'Lahore', paymentTerms: 'Net 15', status: 'Active', rating: 4.4, onTimePct: 91, qualityScore: 94, priceIndex: 103, spendYtd: 26310, balanceDue: 1890, leadTimeDays: 1 },
  { id: 'SUP-103', name: 'Al-Fatah Meats', emoji: '🥩', category: 'Meat & Poultry', contact: 'Bilal Fatah', phone: '+92 333 5512 004', email: 'b.fatah@alfatahmeats.com', city: 'Lahore', paymentTerms: 'Net 7', status: 'Active', rating: 4.7, onTimePct: 94, qualityScore: 96, priceIndex: 101, spendYtd: 71480, balanceDue: 5620, leadTimeDays: 1 },
  { id: 'SUP-104', name: 'Green Valley Produce', emoji: '🥬', category: 'Fruits & Vegetables', contact: 'Hamza Tariq', phone: '+92 345 9002 117', email: 'hello@greenvalley.pk', city: 'Kasur', paymentTerms: 'Net 7', status: 'Active', rating: 4.2, onTimePct: 84, qualityScore: 88, priceIndex: 92, spendYtd: 22940, balanceDue: 980, leadTimeDays: 1 },
  { id: 'SUP-105', name: 'Spice Bazaar Traders', emoji: '🌶️', category: 'Spices & Masalas', contact: 'Nadia Qureshi', phone: '+92 302 1189 456', email: 'nadia@spicebazaar.pk', city: 'Karachi', paymentTerms: 'Net 30', status: 'Active', rating: 4.8, onTimePct: 98, qualityScore: 97, priceIndex: 95, spendYtd: 12780, balanceDue: 0, leadTimeDays: 4 },
  { id: 'SUP-106', name: 'Ocean Catch Seafood', emoji: '🦐', category: 'Seafood', contact: 'Daniel Fernandes', phone: '+92 312 4478 901', email: 'daniel@oceancatch.pk', city: 'Karachi', paymentTerms: 'Net 15', status: 'Active', rating: 3.9, onTimePct: 78, qualityScore: 85, priceIndex: 108, spendYtd: 9840, balanceDue: 2150, leadTimeDays: 3 },
  { id: 'SUP-107', name: 'Crystal Beverages', emoji: '🥤', category: 'Beverages', contact: 'Sana Mirza', phone: '+92 300 8812 345', email: 'trade@crystalbev.pk', city: 'Lahore', paymentTerms: 'Net 30', status: 'Active', rating: 4.3, onTimePct: 93, qualityScore: 90, priceIndex: 99, spendYtd: 15620, balanceDue: 1240, leadTimeDays: 2 },
  { id: 'SUP-108', name: 'Punjab Flour Mills', emoji: '🌾', category: 'Flour & Grains', contact: 'Usman Ghani', phone: '+92 301 2290 776', email: 'usman@punjabflour.pk', city: 'Faisalabad', paymentTerms: 'Net 15', status: 'Active', rating: 4.5, onTimePct: 95, qualityScore: 91, priceIndex: 94, spendYtd: 18460, balanceDue: 760, leadTimeDays: 2 },
  { id: 'SUP-109', name: 'EcoPack Solutions', emoji: '📦', category: 'Packaging', contact: 'Mehwish Ali', phone: '+92 322 6634 812', email: 'mehwish@ecopack.pk', city: 'Lahore', paymentTerms: 'Net 30', status: 'Active', rating: 4.1, onTimePct: 89, qualityScore: 87, priceIndex: 104, spendYtd: 8930, balanceDue: 1450, leadTimeDays: 3 },
  { id: 'SUP-110', name: 'Golden Oil Co.', emoji: '🫒', category: 'Oils & Ghee', contact: 'Kamran Butt', phone: '+92 333 7745 210', email: 'kamran@goldenoil.pk', city: 'Lahore', paymentTerms: 'Net 15', status: 'Active', rating: 4.0, onTimePct: 87, qualityScore: 89, priceIndex: 98, spendYtd: 14210, balanceDue: 0, leadTimeDays: 2 },
  { id: 'SUP-111', name: 'CleanPro Hygiene', emoji: '🧴', category: 'Cleaning Supplies', contact: 'Rachel Thomas', phone: '+92 311 5561 093', email: 'rachel@cleanpro.pk', city: 'Islamabad', paymentTerms: 'Net 30', status: 'Pending', rating: 0, onTimePct: 0, qualityScore: 0, priceIndex: 96, spendYtd: 0, balanceDue: 0, leadTimeDays: 3 },
  { id: 'SUP-112', name: 'Royal Rice House', emoji: '🍚', category: 'Rice & Pulses', contact: 'Faisal Chaudhry', phone: '+92 300 6623 418', email: 'faisal@royalrice.pk', city: 'Gujranwala', paymentTerms: 'Net 30', status: 'Inactive', rating: 3.6, onTimePct: 72, qualityScore: 83, priceIndex: 91, spendYtd: 4120, balanceDue: 0, leadTimeDays: 5 },
]

const purchaseRequests: PurchaseRequest[] = [
  { id: 'PR-2041', item: 'Basmati Rice (Super Kernel)', qty: 100, unit: 'kg', estCost: 260, branch: 'Downtown', requestedBy: 'Chef Asif', reason: 'Below reorder level (6 kg left)', priority: 'Urgent', status: 'Pending', createdAt: minutesAgo(35), aiGenerated: true },
  { id: 'PR-2040', item: 'Chicken Thigh (boneless)', qty: 60, unit: 'kg', estCost: 312, branch: 'Mall Road', requestedBy: 'AI Reorder Engine', reason: 'Forecast: weekend demand +38%', priority: 'High', status: 'Pending', createdAt: minutesAgo(80), aiGenerated: true },
  { id: 'PR-2039', item: 'Fresh Cream', qty: 40, unit: 'L', estCost: 148, branch: 'Downtown', requestedBy: 'Sous Chef Maria', reason: 'Low stock — 4 L remaining', priority: 'High', status: 'Pending', createdAt: minutesAgo(140) },
  { id: 'PR-2038', item: 'Takeaway Boxes (Kraft, L)', qty: 2000, unit: 'pcs', estCost: 340, branch: 'Airport', requestedBy: 'Zain Abbas', reason: 'Delivery volume increase', priority: 'Medium', status: 'Pending', createdAt: minutesAgo(260) },
  { id: 'PR-2037', item: 'Tiger Prawns', qty: 15, unit: 'kg', estCost: 285, branch: 'Mall Road', requestedBy: 'Chef Asif', reason: 'New seafood special', priority: 'Low', status: 'Approved', createdAt: minutesAgo(1440) },
  { id: 'PR-2036', item: 'Kashmiri Chilli Powder', qty: 10, unit: 'kg', estCost: 96, branch: 'Downtown', requestedBy: 'AI Reorder Engine', reason: 'Monthly consumption cycle', priority: 'Medium', status: 'Approved', createdAt: minutesAgo(1800), aiGenerated: true },
  { id: 'PR-2035', item: 'Imported Saffron', qty: 0.5, unit: 'kg', estCost: 820, branch: 'Airport', requestedBy: 'Omar Sheikh', reason: 'Premium menu test', priority: 'Low', status: 'Rejected', createdAt: minutesAgo(2900) },
  { id: 'PR-2034', item: 'Cooking Oil (Canola)', qty: 80, unit: 'L', estCost: 176, branch: 'Downtown', requestedBy: 'Sous Chef Maria', reason: 'Routine restock', priority: 'Medium', status: 'Approved', createdAt: minutesAgo(3300) },
  { id: 'PR-2033', item: 'Mint & Coriander bunches', qty: 120, unit: 'bunch', estCost: 54, branch: 'Mall Road', requestedBy: 'Line Cook Hassan', reason: 'Daily fresh produce', priority: 'High', status: 'Approved', createdAt: minutesAgo(4200) },
  { id: 'PR-2032', item: 'Sanitizer Concentrate', qty: 20, unit: 'L', estCost: 110, branch: 'Airport', requestedBy: 'Zain Abbas', reason: 'Hygiene audit next week', priority: 'Medium', status: 'Pending', createdAt: minutesAgo(5100) },
]

function poHistory(stages: POStatus[], startMinsAgo: number): PurchaseOrder['history'] {
  const by = ['Sara Ahmed', 'Metro Portal', 'Supplier', 'Courier', 'Store Keeper']
  return stages.map((s, i) => ({ status: s, at: minutesAgo(startMinsAgo - i * 360), by: by[i] ?? 'System' }))
}

const purchaseOrders: PurchaseOrder[] = [
  { id: 'PO-7821', supplierId: 'SUP-103', supplier: 'Al-Fatah Meats', branch: 'Downtown', lines: [{ item: 'Chicken Thigh', qty: 50, unit: 'kg', unitPrice: 5.2 }, { item: 'Mutton Leg', qty: 20, unit: 'kg', unitPrice: 11.5 }], total: 490, status: 'In Transit', createdAt: minutesAgo(1500), expectedAt: daysFromNow(0), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit'], 1500) },
  { id: 'PO-7820', supplierId: 'SUP-101', supplier: 'Metro Foods', branch: 'Mall Road', lines: [{ item: 'Basmati Rice', qty: 100, unit: 'kg', unitPrice: 2.6 }, { item: 'Sugar', qty: 50, unit: 'kg', unitPrice: 0.9 }], total: 305, status: 'Confirmed', createdAt: minutesAgo(900), expectedAt: daysFromNow(1), history: poHistory(['Draft', 'Sent', 'Confirmed'], 900) },
  { id: 'PO-7819', supplierId: 'SUP-102', supplier: 'Dairy Fresh', branch: 'Downtown', lines: [{ item: 'Fresh Cream', qty: 40, unit: 'L', unitPrice: 3.7 }, { item: 'Yogurt', qty: 60, unit: 'kg', unitPrice: 1.8 }], total: 256, status: 'Sent', createdAt: minutesAgo(400), expectedAt: daysFromNow(1), history: poHistory(['Draft', 'Sent'], 400) },
  { id: 'PO-7818', supplierId: 'SUP-104', supplier: 'Green Valley Produce', branch: 'Airport', lines: [{ item: 'Tomatoes', qty: 80, unit: 'kg', unitPrice: 0.8 }, { item: 'Onions', qty: 100, unit: 'kg', unitPrice: 0.6 }, { item: 'Green Chillies', qty: 10, unit: 'kg', unitPrice: 1.4 }], total: 138, status: 'Received', createdAt: minutesAgo(3000), expectedAt: daysFromNow(-1), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit', 'Received'], 3000) },
  { id: 'PO-7817', supplierId: 'SUP-105', supplier: 'Spice Bazaar Traders', branch: 'Downtown', lines: [{ item: 'Garam Masala', qty: 8, unit: 'kg', unitPrice: 9.5 }, { item: 'Cumin Seeds', qty: 10, unit: 'kg', unitPrice: 6.2 }], total: 138, status: 'Received', createdAt: minutesAgo(6000), expectedAt: daysFromNow(-3), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit', 'Received'], 6000) },
  { id: 'PO-7816', supplierId: 'SUP-106', supplier: 'Ocean Catch Seafood', branch: 'Mall Road', lines: [{ item: 'Tiger Prawns', qty: 15, unit: 'kg', unitPrice: 18.5 }, { item: 'Fish Fillet (Sole)', qty: 12, unit: 'kg', unitPrice: 9 }], total: 385.5, status: 'In Transit', createdAt: minutesAgo(2200), expectedAt: daysFromNow(0), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit'], 2200) },
  { id: 'PO-7815', supplierId: 'SUP-109', supplier: 'EcoPack Solutions', branch: 'Airport', lines: [{ item: 'Kraft Boxes L', qty: 2000, unit: 'pcs', unitPrice: 0.17 }], total: 340, status: 'Draft', createdAt: minutesAgo(60), expectedAt: daysFromNow(3), history: poHistory(['Draft'], 60) },
  { id: 'PO-7814', supplierId: 'SUP-107', supplier: 'Crystal Beverages', branch: 'Downtown', lines: [{ item: 'Mineral Water 500ml', qty: 40, unit: 'case', unitPrice: 4.2 }, { item: 'Soft Drinks 345ml', qty: 30, unit: 'case', unitPrice: 7.8 }], total: 402, status: 'Received', createdAt: minutesAgo(8000), expectedAt: daysFromNow(-4), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit', 'Received'], 8000) },
  { id: 'PO-7813', supplierId: 'SUP-108', supplier: 'Punjab Flour Mills', branch: 'Mall Road', lines: [{ item: 'Chakki Atta', qty: 150, unit: 'kg', unitPrice: 0.75 }, { item: 'Maida', qty: 50, unit: 'kg', unitPrice: 0.82 }], total: 153.5, status: 'Confirmed', createdAt: minutesAgo(1200), expectedAt: daysFromNow(1), history: poHistory(['Draft', 'Sent', 'Confirmed'], 1200) },
  { id: 'PO-7812', supplierId: 'SUP-112', supplier: 'Royal Rice House', branch: 'Airport', lines: [{ item: 'Sella Rice', qty: 80, unit: 'kg', unitPrice: 2.2 }], total: 176, status: 'Cancelled', createdAt: minutesAgo(9000), expectedAt: daysFromNow(-5), history: poHistory(['Draft', 'Sent'], 9000) },
  { id: 'PO-7811', supplierId: 'SUP-110', supplier: 'Golden Oil Co.', branch: 'Downtown', lines: [{ item: 'Canola Oil', qty: 80, unit: 'L', unitPrice: 2.2 }, { item: 'Desi Ghee', qty: 20, unit: 'kg', unitPrice: 8.4 }], total: 344, status: 'Received', createdAt: minutesAgo(10000), expectedAt: daysFromNow(-6), history: poHistory(['Draft', 'Sent', 'Confirmed', 'In Transit', 'Received'], 10000) },
]

const goodsReceipts: GoodsReceipt[] = [
  { id: 'GRN-3310', poId: 'PO-7818', supplier: 'Green Valley Produce', branch: 'Airport', item: 'Tomatoes', orderedQty: 80, acceptedQty: 74, rejectedQty: 6, unit: 'kg', tempOk: true, inspector: 'Zain Abbas', notes: '6 kg over-ripe / bruised', status: 'Partial', receivedAt: minutesAgo(1500) },
  { id: 'GRN-3309', poId: 'PO-7818', supplier: 'Green Valley Produce', branch: 'Airport', item: 'Onions', orderedQty: 100, acceptedQty: 100, rejectedQty: 0, unit: 'kg', tempOk: true, inspector: 'Zain Abbas', notes: 'Good condition', status: 'Passed', receivedAt: minutesAgo(1500) },
  { id: 'GRN-3308', poId: 'PO-7817', supplier: 'Spice Bazaar Traders', branch: 'Downtown', item: 'Garam Masala', orderedQty: 8, acceptedQty: 8, rejectedQty: 0, unit: 'kg', tempOk: true, inspector: 'Sara Ahmed', notes: 'Sealed, batch #GM-0925', status: 'Passed', receivedAt: minutesAgo(4300) },
  { id: 'GRN-3307', poId: 'PO-7814', supplier: 'Crystal Beverages', branch: 'Downtown', item: 'Soft Drinks 345ml', orderedQty: 30, acceptedQty: 28, rejectedQty: 2, unit: 'case', tempOk: true, inspector: 'Sara Ahmed', notes: '2 cases with dented cans', status: 'Partial', receivedAt: minutesAgo(5800) },
  { id: 'GRN-3306', poId: 'PO-7811', supplier: 'Golden Oil Co.', branch: 'Downtown', item: 'Desi Ghee', orderedQty: 20, acceptedQty: 20, rejectedQty: 0, unit: 'kg', tempOk: true, inspector: 'Chef Asif', notes: 'OK', status: 'Passed', receivedAt: minutesAgo(8600) },
  { id: 'GRN-3305', poId: 'PO-7809', supplier: 'Ocean Catch Seafood', branch: 'Mall Road', item: 'Tiger Prawns', orderedQty: 12, acceptedQty: 0, rejectedQty: 12, unit: 'kg', tempOk: false, inspector: 'Omar Sheikh', notes: 'Arrived at 9°C — cold chain broken', status: 'Failed', receivedAt: minutesAgo(11000) },
  { id: 'GRN-3304', poId: 'PO-7808', supplier: 'Al-Fatah Meats', branch: 'Mall Road', item: 'Chicken Breast', orderedQty: 40, acceptedQty: 40, rejectedQty: 0, unit: 'kg', tempOk: true, inspector: 'Omar Sheikh', notes: 'Core temp 2.4°C', status: 'Passed', receivedAt: minutesAgo(12500) },
  { id: 'GRN-3303', poId: 'PO-7807', supplier: 'Dairy Fresh', branch: 'Downtown', item: 'Yogurt', orderedQty: 60, acceptedQty: 57, rejectedQty: 3, unit: 'kg', tempOk: true, inspector: 'Sara Ahmed', notes: '3 tubs short-dated', status: 'Partial', receivedAt: minutesAgo(14000) },
  { id: 'GRN-3302', poId: 'PO-7821', supplier: 'Al-Fatah Meats', branch: 'Downtown', item: 'Mutton Leg', orderedQty: 20, acceptedQty: 0, rejectedQty: 0, unit: 'kg', tempOk: true, inspector: '—', notes: 'Awaiting delivery', status: 'Pending', receivedAt: minutesAgo(10) },
]

const supplierPayments: SupplierPayment[] = [
  { id: 'SP-901', supplier: 'Al-Fatah Meats', invoice: 'AFM-22841', amount: 5620, dueDate: daysFromNow(-2), method: 'Bank Transfer', status: 'Overdue' },
  { id: 'SP-902', supplier: 'Metro Foods', invoice: 'MF-10932', amount: 3240, dueDate: daysFromNow(4), method: 'Bank Transfer', status: 'Due' },
  { id: 'SP-903', supplier: 'Ocean Catch Seafood', invoice: 'OCS-5521', amount: 2150, dueDate: daysFromNow(1), method: 'Cheque', status: 'Scheduled' },
  { id: 'SP-904', supplier: 'Dairy Fresh', invoice: 'DF-7730', amount: 1890, dueDate: daysFromNow(6), method: 'Bank Transfer', status: 'Due' },
  { id: 'SP-905', supplier: 'EcoPack Solutions', invoice: 'EP-3381', amount: 1450, dueDate: daysFromNow(12), method: 'Bank Transfer', status: 'Due' },
  { id: 'SP-906', supplier: 'Crystal Beverages', invoice: 'CB-9912', amount: 1240, dueDate: daysFromNow(-6), method: 'Card', status: 'Paid' },
  { id: 'SP-907', supplier: 'Green Valley Produce', invoice: 'GV-4410', amount: 980, dueDate: daysFromNow(2), method: 'Cash', status: 'Scheduled' },
  { id: 'SP-908', supplier: 'Punjab Flour Mills', invoice: 'PFM-1182', amount: 760, dueDate: daysFromNow(9), method: 'Bank Transfer', status: 'Due' },
  { id: 'SP-909', supplier: 'Spice Bazaar Traders', invoice: 'SB-7781', amount: 1310, dueDate: daysFromNow(-10), method: 'Bank Transfer', status: 'Paid' },
  { id: 'SP-910', supplier: 'Golden Oil Co.', invoice: 'GO-6603', amount: 344, dueDate: daysFromNow(-8), method: 'Cheque', status: 'Paid' },
]

const supplierReturns: SupplierReturn[] = [
  { id: 'RTN-501', supplier: 'Ocean Catch Seafood', item: 'Tiger Prawns', qty: 12, unit: 'kg', reason: 'Cold chain broken (9°C)', credit: 222, status: 'Approved', createdAt: minutesAgo(10900) },
  { id: 'RTN-502', supplier: 'Green Valley Produce', item: 'Tomatoes', qty: 6, unit: 'kg', reason: 'Over-ripe / bruised', credit: 4.8, status: 'Pending', createdAt: minutesAgo(1400) },
  { id: 'RTN-503', supplier: 'Crystal Beverages', item: 'Soft Drinks 345ml', qty: 2, unit: 'case', reason: 'Damaged packaging', credit: 15.6, status: 'Resolved', createdAt: minutesAgo(5700) },
  { id: 'RTN-504', supplier: 'Dairy Fresh', item: 'Yogurt', qty: 3, unit: 'kg', reason: 'Short-dated (< 2 days)', credit: 5.4, status: 'Pending', createdAt: minutesAgo(13900) },
  { id: 'RTN-505', supplier: 'Metro Foods', item: 'Lentils (Masoor)', qty: 5, unit: 'kg', reason: 'Pest contamination found', credit: 7.5, status: 'Rejected', createdAt: minutesAgo(20000) },
]

export const supplierSpendTrend = [
  { m: 'May', spend: 21400, savings: 640 },
  { m: 'Jun', spend: 22800, savings: 910 },
  { m: 'Jul', spend: 24100, savings: 1120 },
  { m: 'Aug', spend: 23600, savings: 1380 },
  { m: 'Sep', spend: 25200, savings: 1610 },
  { m: 'Oct', spend: 19800, savings: 1240 },
]

export const getSuppliers = () => request<Supplier[]>('/procurement/suppliers', suppliers)
export const createSupplier = (s: Supplier) => mutate('/procurement/suppliers', 'POST', s)
export const getPurchaseRequests = () => request<PurchaseRequest[]>('/procurement/purchase-requests', purchaseRequests)
export const updatePurchaseRequest = (pr: PurchaseRequest) => mutate(`/procurement/purchase-requests/${pr.id}`, 'PATCH', pr)
export const getPurchaseOrders = () => request<PurchaseOrder[]>('/procurement/purchase-orders', purchaseOrders)
export const createPurchaseOrder = (po: PurchaseOrder) => mutate('/procurement/purchase-orders', 'POST', po)
export const updatePurchaseOrder = (po: PurchaseOrder) => mutate(`/procurement/purchase-orders/${po.id}`, 'PATCH', po)
export const getGoodsReceipts = () => request<GoodsReceipt[]>('/procurement/goods-receipts', goodsReceipts)
export const createGoodsReceipt = (g: GoodsReceipt) => mutate('/procurement/goods-receipts', 'POST', g)
export const getSupplierPayments = () => request<SupplierPayment[]>('/procurement/supplier-payments', supplierPayments)
export const paySupplier = (p: SupplierPayment) => mutate(`/procurement/supplier-payments/${p.id}/pay`, 'POST', p)
export const getSupplierReturns = () => request<SupplierReturn[]>('/procurement/returns', supplierReturns)
export const createSupplierReturn = (r: SupplierReturn) => mutate('/procurement/returns', 'POST', r)

/* ════════════════════════════ Customers & Loyalty ════════════════════════════ */

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
export const TIERS: { tier: LoyaltyTier; min: number; perks: string; emoji: string; gradient: string }[] = [
  { tier: 'Bronze', min: 0, perks: '1 pt per $1 · Birthday dessert', emoji: '🥉', gradient: 'from-amber-700 to-orange-500' },
  { tier: 'Silver', min: 1000, perks: '1.25× points · Free delivery once a month', emoji: '🥈', gradient: 'from-slate-500 to-slate-300' },
  { tier: 'Gold', min: 3000, perks: '1.5× points · Priority reservations · 10% off', emoji: '🥇', gradient: 'from-yellow-500 to-amber-300' },
  { tier: 'Platinum', min: 7000, perks: '2× points · Chef’s table invites · 15% off', emoji: '💎', gradient: 'from-indigo-600 to-violet-400' },
]

export interface CustomerOrder {
  id: string
  date: string
  channel: 'Dine-in' | 'Delivery' | 'Takeaway' | 'Online'
  items: string
  total: number
  branch: Branch
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  tier: LoyaltyTier
  points: number
  visits: number
  totalSpend: number
  avgOrder: number
  lastVisit: string
  favourite: string
  segment: string
  churnRisk: number // 0..100
  joined: string
  branch: Branch
  membership?: string
  tags: string[]
  orders: CustomerOrder[]
}

export interface Reward {
  id: string
  name: string
  emoji: string
  cost: number
  redeemed: number
  active: boolean
}

export interface GiftCard {
  id: string
  code: string
  holder: string
  initial: number
  balance: number
  issued: string
  expires: string
  status: 'Active' | 'Redeemed' | 'Expired'
}

export interface MembershipPlan {
  id: string
  name: string
  price: number
  period: 'month' | 'year'
  members: number
  benefits: string[]
  color: string
}

export interface Feedback {
  id: string
  customer: string
  branch: Branch
  channel: 'Google' | 'In-app' | 'QR Survey' | 'Foodpanda' | 'Instagram'
  rating: number
  comment: string
  sentiment: 'Positive' | 'Neutral' | 'Negative'
  topic: string
  status: 'New' | 'In Progress' | 'Resolved'
  createdAt: string
}

export interface Segment {
  id: string
  name: string
  description: string
  size: number
  avgSpend: number
  color: string
  offer?: string
}

export interface Offer {
  id: string
  name: string
  segment: string
  discount: string
  channel: string
  redemptions: number
  status: 'Active' | 'Scheduled' | 'Draft' | 'Expired'
  endsAt: string
}

const dishes = ['Chicken Karahi', 'Mutton Biryani', 'Paneer Tikka', 'Butter Chicken', 'Seekh Kebab Platter', 'Dal Makhani', 'Prawn Masala', 'Garlic Naan', 'Mango Lassi', 'Chicken Tikka Wrap']
const channels: CustomerOrder['channel'][] = ['Dine-in', 'Delivery', 'Takeaway', 'Online']

function ordersFor(seed: number, n: number, avg: number): CustomerOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `ORD-${58200 - seed * 13 - i * 7}`,
    date: daysFromNow(-(i * 6 + (seed % 5) + 1)),
    channel: channels[(seed + i) % channels.length],
    items: `${dishes[(seed + i) % dishes.length]}, ${dishes[(seed + i * 3 + 2) % dishes.length]}`,
    total: Math.round(avg * (0.75 + ((seed * 7 + i * 11) % 50) / 100) * 100) / 100,
    branch: BRANCHES[(seed + i) % 3],
  }))
}

type CustomerSeed = [string, string, LoyaltyTier, number, number, number, number, string, string, number, string?]
const customerSeeds: CustomerSeed[] = [
  ['Ahmed Raza', 'ahmed.raza@gmail.com', 'Platinum', 8420, 64, 4980, 2, 'Chicken Karahi', 'VIP Regulars', 6, 'Spice Club Annual'],
  ['Fatima Malik', 'fatima.malik@outlook.com', 'Gold', 4310, 38, 2640, 5, 'Paneer Tikka', 'Family Diners', 14, 'Spice Club Monthly'],
  ['Emily Carter', 'emily.carter@yahoo.com', 'Silver', 1820, 17, 1150, 12, 'Butter Chicken', 'Expats & Tourists', 38],
  ['Hassan Ali', 'hassan.ali@gmail.com', 'Gold', 3560, 31, 2210, 3, 'Mutton Biryani', 'Weekend Feasters', 9],
  ['Zainab Hussain', 'zainab.h@gmail.com', 'Bronze', 420, 5, 260, 46, 'Mango Lassi', 'At-risk', 82],
  ['Omar Farooq', 'omar.farooq@hotmail.com', 'Platinum', 9120, 72, 5630, 1, 'Seekh Kebab Platter', 'VIP Regulars', 4, 'Spice Club Annual'],
  ['Sophia Martinez', 'sophia.m@gmail.com', 'Silver', 1340, 12, 890, 21, 'Prawn Masala', 'Expats & Tourists', 44],
  ['Bilal Ahmed', 'bilal.ahmed@gmail.com', 'Bronze', 680, 8, 410, 33, 'Chicken Tikka Wrap', 'Lunch Office Crowd', 61],
  ['Ayesha Siddiqui', 'ayesha.s@gmail.com', 'Gold', 3920, 35, 2480, 4, 'Dal Makhani', 'Family Diners', 11, 'Spice Club Monthly'],
  ['James Wilson', 'jwilson@gmail.com', 'Bronze', 210, 3, 140, 58, 'Butter Chicken', 'At-risk', 88],
  ['Mariam Qureshi', 'mariam.q@gmail.com', 'Silver', 2240, 22, 1430, 7, 'Mutton Biryani', 'Delivery Lovers', 22],
  ['Usman Tariq', 'usman.tariq@gmail.com', 'Silver', 1590, 15, 1010, 16, 'Chicken Karahi', 'Lunch Office Crowd', 35],
  ['Hira Batool', 'hira.batool@gmail.com', 'Gold', 3140, 29, 1980, 6, 'Paneer Tikka', 'Delivery Lovers', 18],
  ['Daniel Kim', 'daniel.kim@gmail.com', 'Bronze', 520, 6, 330, 27, 'Garlic Naan', 'Expats & Tourists', 57],
  ['Sana Javed', 'sana.javed@gmail.com', 'Platinum', 7340, 58, 4410, 3, 'Prawn Masala', 'VIP Regulars', 7, 'Spice Club Annual'],
  ['Kamran Akmal', 'kamran.a@gmail.com', 'Bronze', 860, 9, 540, 39, 'Seekh Kebab Platter', 'At-risk', 74],
  ['Priya Sharma', 'priya.sharma@gmail.com', 'Silver', 1980, 19, 1240, 9, 'Dal Makhani', 'Weekend Feasters', 26],
  ['Ali Haider', 'ali.haider@gmail.com', 'Gold', 4650, 41, 2890, 2, 'Mutton Biryani', 'Weekend Feasters', 8, 'Spice Club Monthly'],
  ['Noor Fatima', 'noor.f@gmail.com', 'Bronze', 140, 2, 90, 64, 'Mango Lassi', 'At-risk', 91],
  ['Michael Brown', 'm.brown@gmail.com', 'Silver', 1210, 11, 760, 14, 'Chicken Karahi', 'Expats & Tourists', 41],
]

const customers: Customer[] = customerSeeds.map(([name, email, tier, points, visits, spend, lastDays, fav, segment, churn, membership], i) => ({
  id: `CUS-${1001 + i}`,
  name,
  email,
  phone: `+92 3${(i * 7) % 10}${(i * 3) % 10} ${String(1000000 + i * 734521).slice(0, 7).replace(/(\d{3})(\d{4})/, '$1 $2')}`,
  tier,
  points,
  visits,
  totalSpend: spend,
  avgOrder: Math.round((spend / visits) * 100) / 100,
  lastVisit: daysFromNow(-lastDays),
  favourite: fav,
  segment,
  churnRisk: churn,
  joined: daysFromNow(-(120 + i * 37)),
  branch: BRANCHES[i % 3],
  membership,
  tags: [segment, ...(churn > 60 ? ['Win-back'] : []), ...(tier === 'Platinum' ? ['VIP'] : [])],
  orders: ordersFor(i + 1, Math.min(6, Math.max(2, Math.round(visits / 8))), spend / visits),
}))

const rewards: Reward[] = [
  { id: 'RW-1', name: 'Free Mango Lassi', emoji: '🥭', cost: 150, redeemed: 412, active: true },
  { id: 'RW-2', name: 'Free Garlic Naan basket', emoji: '🫓', cost: 200, redeemed: 318, active: true },
  { id: 'RW-3', name: 'Dessert of the day', emoji: '🍮', cost: 300, redeemed: 226, active: true },
  { id: 'RW-4', name: '$10 off your bill', emoji: '💵', cost: 800, redeemed: 184, active: true },
  { id: 'RW-5', name: 'Free Chicken Karahi (half)', emoji: '🍲', cost: 1200, redeemed: 97, active: true },
  { id: 'RW-6', name: 'Chef’s table for two', emoji: '👨‍🍳', cost: 5000, redeemed: 12, active: true },
  { id: 'RW-7', name: 'Free delivery week', emoji: '🛵', cost: 600, redeemed: 0, active: false },
]

const giftCards: GiftCard[] = [
  { id: 'GC-1', code: 'SRK-8F2K-11QZ', holder: 'Ahmed Raza', initial: 100, balance: 42.5, issued: daysFromNow(-40), expires: daysFromNow(325), status: 'Active' },
  { id: 'GC-2', code: 'SRK-2M9P-77LA', holder: 'Emily Carter', initial: 50, balance: 50, issued: daysFromNow(-12), expires: daysFromNow(353), status: 'Active' },
  { id: 'GC-3', code: 'SRK-6T1W-90RE', holder: 'Hassan Ali', initial: 75, balance: 0, issued: daysFromNow(-120), expires: daysFromNow(245), status: 'Redeemed' },
  { id: 'GC-4', code: 'SRK-4D7N-35KX', holder: 'Corporate — Systems Ltd', initial: 500, balance: 318, issued: daysFromNow(-60), expires: daysFromNow(305), status: 'Active' },
  { id: 'GC-5', code: 'SRK-9H3C-12VB', holder: 'Sophia Martinez', initial: 25, balance: 25, issued: daysFromNow(-400), expires: daysFromNow(-35), status: 'Expired' },
  { id: 'GC-6', code: 'SRK-1Q8E-64ZT', holder: 'Hira Batool', initial: 100, balance: 87, issued: daysFromNow(-8), expires: daysFromNow(357), status: 'Active' },
]

const memberships: MembershipPlan[] = [
  { id: 'MP-1', name: 'Spice Club Monthly', price: 9.99, period: 'month', members: 486, benefits: ['10% off every order', 'Free delivery ×4', 'Members-only dishes'], color: 'from-brand-600 to-amber-500' },
  { id: 'MP-2', name: 'Spice Club Annual', price: 99, period: 'year', members: 212, benefits: ['15% off every order', 'Unlimited free delivery', 'Chef’s table priority', '2× loyalty points'], color: 'from-violet-600 to-fuchsia-500' },
  { id: 'MP-3', name: 'Corporate Lunch Pass', price: 49, period: 'month', members: 64, benefits: ['20 lunch boxes / month', 'Office delivery slot', 'Monthly invoice'], color: 'from-sky-600 to-teal-500' },
]

const feedback: Feedback[] = [
  { id: 'FB-801', customer: 'Emily Carter', branch: 'Mall Road', channel: 'Google', rating: 5, comment: 'Best butter chicken in town, staff were incredibly warm!', sentiment: 'Positive', topic: 'Food quality', status: 'Resolved', createdAt: minutesAgo(90) },
  { id: 'FB-802', customer: 'Bilal Ahmed', branch: 'Downtown', channel: 'Foodpanda', rating: 2, comment: 'Delivery took 70 minutes and the naan was cold.', sentiment: 'Negative', topic: 'Delivery time', status: 'New', createdAt: minutesAgo(130) },
  { id: 'FB-803', customer: 'Fatima Malik', branch: 'Downtown', channel: 'QR Survey', rating: 4, comment: 'Great food, but music was a bit loud for a family dinner.', sentiment: 'Neutral', topic: 'Ambience', status: 'In Progress', createdAt: minutesAgo(300) },
  { id: 'FB-804', customer: 'James Wilson', branch: 'Airport', channel: 'In-app', rating: 1, comment: 'Charged twice for my order. Still waiting for refund.', sentiment: 'Negative', topic: 'Billing', status: 'In Progress', createdAt: minutesAgo(520) },
  { id: 'FB-805', customer: 'Omar Farooq', branch: 'Mall Road', channel: 'Instagram', rating: 5, comment: 'Seekh kebab platter 🔥🔥 never disappoints.', sentiment: 'Positive', topic: 'Food quality', status: 'Resolved', createdAt: minutesAgo(800) },
  { id: 'FB-806', customer: 'Zainab Hussain', branch: 'Downtown', channel: 'Google', rating: 2, comment: 'Biryani portion was smaller than last time.', sentiment: 'Negative', topic: 'Portion size', status: 'New', createdAt: minutesAgo(1100) },
  { id: 'FB-807', customer: 'Priya Sharma', branch: 'Airport', channel: 'QR Survey', rating: 4, comment: 'Quick service before my flight, thank you!', sentiment: 'Positive', topic: 'Service speed', status: 'Resolved', createdAt: minutesAgo(1500) },
  { id: 'FB-808', customer: 'Daniel Kim', branch: 'Mall Road', channel: 'In-app', rating: 3, comment: 'Food good, app checkout was confusing.', sentiment: 'Neutral', topic: 'App experience', status: 'New', createdAt: minutesAgo(2100) },
  { id: 'FB-809', customer: 'Sana Javed', branch: 'Downtown', channel: 'Google', rating: 5, comment: 'Prawn masala is a must-try. Lovely evening.', sentiment: 'Positive', topic: 'Food quality', status: 'Resolved', createdAt: minutesAgo(2900) },
  { id: 'FB-810', customer: 'Kamran Akmal', branch: 'Airport', channel: 'Foodpanda', rating: 2, comment: 'Order missing the raita and salad.', sentiment: 'Negative', topic: 'Order accuracy', status: 'In Progress', createdAt: minutesAgo(3400) },
  { id: 'FB-811', customer: 'Ayesha Siddiqui', branch: 'Mall Road', channel: 'QR Survey', rating: 5, comment: 'Waiter Ahsan was fantastic with the kids.', sentiment: 'Positive', topic: 'Staff', status: 'Resolved', createdAt: minutesAgo(4200) },
  { id: 'FB-812', customer: 'Michael Brown', branch: 'Downtown', channel: 'Google', rating: 4, comment: 'Authentic taste, slightly pricey.', sentiment: 'Neutral', topic: 'Pricing', status: 'New', createdAt: minutesAgo(5000) },
]

const segments: Segment[] = [
  { id: 'SEG-1', name: 'VIP Regulars', description: '20+ visits, spend > $3k', size: 184, avgSpend: 412, color: '#8b5cf6', offer: 'Chef’s tasting preview' },
  { id: 'SEG-2', name: 'Family Diners', description: 'Party size ≥ 4, weekends', size: 642, avgSpend: 96, color: '#fe5a11', offer: 'Kids eat free Sundays' },
  { id: 'SEG-3', name: 'Lunch Office Crowd', description: 'Weekday 12–3 PM orders', size: 918, avgSpend: 14, color: '#0ea5e9', offer: 'Lunch combo $9.99' },
  { id: 'SEG-4', name: 'Delivery Lovers', description: '> 70% orders via delivery', size: 1240, avgSpend: 22, color: '#10b981', offer: 'Free delivery over $25' },
  { id: 'SEG-5', name: 'Weekend Feasters', description: 'Fri–Sun dinners, high basket', size: 516, avgSpend: 64, color: '#f59e0b' },
  { id: 'SEG-6', name: 'Expats & Tourists', description: 'International cards / Airport', size: 372, avgSpend: 38, color: '#ec4899', offer: 'Taste of Pakistan set' },
  { id: 'SEG-7', name: 'At-risk', description: 'No visit in 30+ days', size: 288, avgSpend: 27, color: '#ef4444', offer: 'We miss you — 20% off' },
]

const offers: Offer[] = [
  { id: 'OF-1', name: 'We miss you — 20% off', segment: 'At-risk', discount: '20%', channel: 'SMS + WhatsApp', redemptions: 46, status: 'Active', endsAt: daysFromNow(9) },
  { id: 'OF-2', name: 'Lunch combo $9.99', segment: 'Lunch Office Crowd', discount: '$4 off', channel: 'App push', redemptions: 812, status: 'Active', endsAt: daysFromNow(21) },
  { id: 'OF-3', name: 'Kids eat free Sundays', segment: 'Family Diners', discount: 'Free kids meal', channel: 'Email', redemptions: 214, status: 'Active', endsAt: daysFromNow(30) },
  { id: 'OF-4', name: 'Double points weekend', segment: 'All members', discount: '2× points', channel: 'App + Email', redemptions: 0, status: 'Scheduled', endsAt: daysFromNow(5) },
  { id: 'OF-5', name: 'Taste of Pakistan set', segment: 'Expats & Tourists', discount: '15%', channel: 'QR at Airport', redemptions: 98, status: 'Active', endsAt: daysFromNow(14) },
  { id: 'OF-6', name: 'Ramadan Sehri deal', segment: 'All', discount: '25%', channel: 'Social', redemptions: 1630, status: 'Expired', endsAt: daysFromNow(-160) },
]

export const getCustomers = () => request<Customer[]>('/customers', customers)
export const createCustomer = (c: Customer) => mutate('/customers', 'POST', c)
export const adjustPoints = (id: string, delta: number) => mutate(`/customers/${id}/points`, 'POST', { delta })
export const getRewards = () => request<Reward[]>('/loyalty/rewards', rewards)
export const getGiftCards = () => request<GiftCard[]>('/loyalty/gift-cards', giftCards)
export const issueGiftCard = (g: GiftCard) => mutate('/loyalty/gift-cards', 'POST', g)
export const getMemberships = () => request<MembershipPlan[]>('/loyalty/memberships', memberships)
export const getFeedback = () => request<Feedback[]>('/customers/feedback', feedback)
export const updateFeedback = (f: Feedback) => mutate(`/customers/feedback/${f.id}`, 'PATCH', f)
export const getSegments = () => request<Segment[]>('/customers/segments', segments)
export const getOffers = () => request<Offer[]>('/customers/offers', offers)
export const createOffer = (o: Offer) => mutate('/customers/offers', 'POST', o)

/* ════════════════════════════ Online Menu ════════════════════════════ */

export interface OnlineMenuItem {
  id: string
  name: string
  category: string
  emoji: string
  description: string
  price: number
  promoPrice?: number
  available: boolean
  featured: boolean
  tags: string[]
  channels: string[]
}

export interface PublishTarget {
  id: string
  name: string
  emoji: string
  kind: 'Owned' | 'Aggregator'
  url: string
  status: 'Published' | 'Draft' | 'Failed' | 'Pending'
  sync: 'Synced' | 'Out of sync' | 'Syncing' | 'Error'
  lastSync: string
  items: number
  ordersToday: number
}

export interface DigitalPromo {
  id: string
  title: string
  description: string
  type: 'Banner' | 'Combo' | 'Discount' | 'Happy hour'
  channels: string[]
  status: 'Active' | 'Scheduled' | 'Draft' | 'Expired'
  startsAt: string
  endsAt: string
  clicks: number
}

export interface MenuContentSuggestion {
  id: string
  itemId: string
  item: string
  current: string
  suggested: string
  reason: string
  uplift: string
}

const onlineMenu: OnlineMenuItem[] = [
  { id: 'OM-1', name: 'Chicken Karahi', category: 'Mains', emoji: '🍲', description: 'Wok-tossed chicken with tomatoes, ginger and green chillies.', price: 14.5, available: true, featured: true, tags: ['Bestseller', 'Spicy'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-2', name: 'Mutton Biryani', category: 'Rice', emoji: '🍛', description: 'Aged basmati layered with slow-cooked mutton and saffron.', price: 16, available: true, featured: true, tags: ['Signature'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-3', name: 'Paneer Tikka', category: 'Starters', emoji: '🧀', description: 'Cottage cheese cubes in tandoori marinade.', price: 9.5, promoPrice: 7.99, available: true, featured: false, tags: ['Vegetarian'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda'] },
  { id: 'OM-4', name: 'Butter Chicken', category: 'Mains', emoji: '🍗', description: 'Tandoori chicken in a velvety tomato-butter gravy.', price: 15, available: true, featured: true, tags: ['Mild'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-5', name: 'Seekh Kebab Platter', category: 'Grill', emoji: '🍢', description: 'Six minced beef seekh kebabs, mint chutney, onion salad.', price: 13, available: true, featured: false, tags: ['Grill'], channels: ['Website', 'QR Menu', 'Mobile App', 'Careem'] },
  { id: 'OM-6', name: 'Prawn Masala', category: 'Mains', emoji: '🦐', description: 'Tiger prawns in coastal masala.', price: 18.5, available: false, featured: false, tags: ['Seafood'], channels: ['Website', 'QR Menu'] },
  { id: 'OM-7', name: 'Dal Makhani', category: 'Mains', emoji: '🥘', description: 'Black lentils simmered overnight with cream and butter.', price: 8.5, available: true, featured: false, tags: ['Vegetarian'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-8', name: 'Garlic Naan', category: 'Breads', emoji: '🫓', description: 'Tandoor-baked naan with garlic butter.', price: 2.5, available: true, featured: false, tags: [], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-9', name: 'Chicken Tikka Wrap', category: 'Street Food', emoji: '🌯', description: 'Chicken tikka, pickled onions and garlic mayo in paratha.', price: 7.5, promoPrice: 5.99, available: true, featured: true, tags: ['Lunch deal'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Uber Eats'] },
  { id: 'OM-10', name: 'Mango Lassi', category: 'Drinks', emoji: '🥭', description: 'Chaunsa mango blended with yogurt.', price: 4, available: true, featured: false, tags: ['Seasonal'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem', 'Uber Eats'] },
  { id: 'OM-11', name: 'Kashmiri Chai', category: 'Drinks', emoji: '🍵', description: 'Pink tea with pistachio and almonds.', price: 3.5, available: true, featured: false, tags: [], channels: ['Website', 'QR Menu', 'Mobile App'] },
  { id: 'OM-12', name: 'Gulab Jamun', category: 'Desserts', emoji: '🍮', description: 'Warm milk dumplings in rose-cardamom syrup.', price: 4.5, available: true, featured: false, tags: ['Dessert'], channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda', 'Careem'] },
  { id: 'OM-13', name: 'Chapli Kebab Burger', category: 'Street Food', emoji: '🍔', description: 'Peshawari chapli kebab in brioche bun.', price: 8.99, available: false, featured: false, tags: ['New'], channels: ['Website', 'Mobile App'] },
]

const publishTargets: PublishTarget[] = [
  { id: 'web', name: 'Website', emoji: '🌐', kind: 'Owned', url: 'spiceroutekitchen.com/menu', status: 'Published', sync: 'Synced', lastSync: minutesAgo(4), items: 13, ordersToday: 86 },
  { id: 'qr', name: 'QR Menu', emoji: '📱', kind: 'Owned', url: 'menu.restaurantos.app/spice-route', status: 'Published', sync: 'Synced', lastSync: minutesAgo(4), items: 13, ordersToday: 142 },
  { id: 'app', name: 'Mobile App', emoji: '📲', kind: 'Owned', url: 'iOS & Android', status: 'Published', sync: 'Out of sync', lastSync: minutesAgo(95), items: 12, ordersToday: 64 },
  { id: 'foodpanda', name: 'Foodpanda', emoji: '🐼', kind: 'Aggregator', url: 'foodpanda.pk/spice-route-kitchen', status: 'Published', sync: 'Synced', lastSync: minutesAgo(12), items: 10, ordersToday: 118 },
  { id: 'careem', name: 'Careem', emoji: '🟢', kind: 'Aggregator', url: 'careem.com/food/spice-route', status: 'Published', sync: 'Error', lastSync: minutesAgo(310), items: 9, ordersToday: 37 },
  { id: 'ubereats', name: 'Uber Eats', emoji: '🚗', kind: 'Aggregator', url: 'ubereats.com/store/spice-route', status: 'Pending', sync: 'Out of sync', lastSync: minutesAgo(1440), items: 8, ordersToday: 0 },
]

const digitalPromos: DigitalPromo[] = [
  { id: 'DP-1', title: 'Lunch Wrap Deal', description: 'Chicken Tikka Wrap + drink for $7.99, weekdays 12–3', type: 'Combo', channels: ['Website', 'Mobile App', 'Foodpanda'], status: 'Active', startsAt: daysFromNow(-6), endsAt: daysFromNow(24), clicks: 3420 },
  { id: 'DP-2', title: 'Paneer Week', description: '16% off Paneer Tikka across all channels', type: 'Discount', channels: ['Website', 'QR Menu', 'Mobile App', 'Foodpanda'], status: 'Active', startsAt: daysFromNow(-2), endsAt: daysFromNow(5), clicks: 1190 },
  { id: 'DP-3', title: 'Chai Happy Hour', description: '2-for-1 Kashmiri Chai, 4–6 PM', type: 'Happy hour', channels: ['QR Menu'], status: 'Scheduled', startsAt: daysFromNow(2), endsAt: daysFromNow(16), clicks: 0 },
  { id: 'DP-4', title: 'Mango Season Banner', description: 'Hero banner featuring Mango Lassi & desserts', type: 'Banner', channels: ['Website', 'Mobile App'], status: 'Expired', startsAt: daysFromNow(-90), endsAt: daysFromNow(-20), clicks: 8840 },
  { id: 'DP-5', title: 'Family Feast Box', description: 'Karahi + Biryani + 4 naan + dessert for $39', type: 'Combo', channels: ['Website', 'Mobile App', 'Careem', 'Uber Eats'], status: 'Draft', startsAt: daysFromNow(7), endsAt: daysFromNow(37), clicks: 0 },
]

const menuSuggestions: MenuContentSuggestion[] = [
  { id: 'MS-1', itemId: 'OM-3', item: 'Paneer Tikka', current: 'Cottage cheese cubes in tandoori marinade.', suggested: 'Smoky charcoal-kissed paneer, marinated overnight in yogurt, Kashmiri chilli and mustard oil — served sizzling with mint chutney.', reason: 'Sensory words lift conversion for “puzzle” items', uplift: '+14% est. orders' },
  { id: 'MS-2', itemId: 'OM-6', item: 'Prawn Masala', current: 'Tiger prawns in coastal masala.', suggested: 'Plump tiger prawns tossed in a fiery Karachi-style coastal masala with curry leaves and a squeeze of lime.', reason: 'Short description underperforms on aggregators', uplift: '+9% est. CTR' },
  { id: 'MS-3', itemId: 'OM-10', item: 'Mango Lassi', current: 'Chaunsa mango blended with yogurt.', suggested: 'Thick, chilled lassi made with sun-ripened Chaunsa mangoes — the perfect cool-down for your karahi.', reason: 'Pairing cue increases attach rate', uplift: '+11% attach rate' },
  { id: 'MS-4', itemId: 'OM-12', item: 'Gulab Jamun', current: 'Warm milk dumplings in rose-cardamom syrup.', suggested: 'Two warm, melt-in-your-mouth gulab jamun soaked in rose & cardamom syrup. Add vanilla ice cream for $1.', reason: 'Upsell hook for dessert add-on', uplift: '+$0.42 avg basket' },
]

export const menuChannelPerformance = [
  { channel: 'QR Menu', orders: 142, conv: 31 },
  { channel: 'Foodpanda', orders: 118, conv: 18 },
  { channel: 'Website', orders: 86, conv: 12 },
  { channel: 'Mobile App', orders: 64, conv: 24 },
  { channel: 'Careem', orders: 37, conv: 9 },
  { channel: 'Uber Eats', orders: 0, conv: 0 },
]

export const getOnlineMenu = () => request<OnlineMenuItem[]>('/online-menu/items', onlineMenu)
export const updateOnlineMenuItem = (i: OnlineMenuItem) => mutate(`/online-menu/items/${i.id}`, 'PUT', i)
export const getPublishTargets = () => request<PublishTarget[]>('/online-menu/channels', publishTargets)
export const syncChannel = (id: string) => mutate(`/online-menu/channels/${id}/sync`, 'POST', { id })
export const getDigitalPromos = () => request<DigitalPromo[]>('/online-menu/promotions', digitalPromos)
export const createDigitalPromo = (p: DigitalPromo) => mutate('/online-menu/promotions', 'POST', p)
export const getMenuSuggestions = () => request<MenuContentSuggestion[]>('/ai/menu-content', menuSuggestions)

/* ════════════════════════════ Social Media & Marketing ════════════════════════════ */

export type SocialPlatform = 'Instagram' | 'Facebook' | 'TikTok' | 'Google Business' | 'X'
export const SOCIAL_PLATFORMS: { id: SocialPlatform; short: string; gradient: string; glyph: string }[] = [
  { id: 'Instagram', short: 'IG', gradient: 'from-fuchsia-500 via-pink-500 to-amber-400', glyph: '📸' },
  { id: 'Facebook', short: 'FB', gradient: 'from-blue-600 to-blue-500', glyph: 'f' },
  { id: 'TikTok', short: 'TT', gradient: 'from-slate-900 to-slate-700', glyph: '♪' },
  { id: 'Google Business', short: 'G', gradient: 'from-sky-500 to-emerald-500', glyph: 'G' },
  { id: 'X', short: 'X', gradient: 'from-slate-800 to-black', glyph: '𝕏' },
]

export interface SocialAccount {
  platform: SocialPlatform
  handle: string
  connected: boolean
  followers: number
  growth: number
  lastPost?: string
}

export interface SocialPost {
  id: string
  caption: string
  platforms: SocialPlatform[]
  media: string // emoji
  status: 'Published' | 'Scheduled' | 'Pending' | 'Draft' | 'Rejected'
  scheduledAt: string
  author: string
  campaign?: string
  likes: number
  comments: number
  shares: number
  reach: number
}

export interface Campaign {
  id: string
  name: string
  objective: 'Awareness' | 'Engagement' | 'Orders' | 'Footfall'
  platforms: SocialPlatform[]
  budget: number
  spent: number
  reach: number
  clicks: number
  conversions: number
  status: 'Active' | 'Scheduled' | 'Draft' | 'Completed'
  startsAt: string
  endsAt: string
}

const socialAccounts: SocialAccount[] = [
  { platform: 'Instagram', handle: '@spiceroutekitchen', connected: true, followers: 48200, growth: 6.4, lastPost: minutesAgo(180) },
  { platform: 'Facebook', handle: 'Spice Route Kitchen', connected: true, followers: 31600, growth: 2.1, lastPost: minutesAgo(180) },
  { platform: 'TikTok', handle: '@spiceroute.eats', connected: true, followers: 22900, growth: 14.8, lastPost: minutesAgo(1500) },
  { platform: 'Google Business', handle: 'Spice Route Kitchen (3 locations)', connected: true, followers: 5800, growth: 3.2, lastPost: minutesAgo(4300) },
  { platform: 'X', handle: '@SpiceRouteKtchn', connected: false, followers: 2100, growth: -0.4 },
]

function at(dayOffset: number, hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const socialPosts: SocialPost[] = [
  { id: 'SP-1', caption: 'Friday nights were made for Karahi 🔥 Book your table at any of our 3 branches.', platforms: ['Instagram', 'Facebook'], media: '🍲', status: 'Published', scheduledAt: at(-3, 19), author: 'Mehak (Marketing)', campaign: 'Karahi Fridays', likes: 2840, comments: 196, shares: 88, reach: 41200 },
  { id: 'SP-2', caption: 'Behind the tandoor: watch our naan go from dough to golden in 90 seconds.', platforms: ['TikTok', 'Instagram'], media: '🫓', status: 'Published', scheduledAt: at(-2, 13), author: 'Mehak (Marketing)', likes: 9120, comments: 412, shares: 1310, reach: 128000 },
  { id: 'SP-3', caption: 'New: Chapli Kebab Burger lands at Mall Road this weekend 🍔', platforms: ['Instagram', 'Facebook', 'X'], media: '🍔', status: 'Published', scheduledAt: at(-1, 17), author: 'Ali (Brand)', campaign: 'New Menu Launch', likes: 1980, comments: 142, shares: 64, reach: 26400 },
  { id: 'SP-4', caption: 'Lunch Wrap Deal — $7.99 with a drink, weekdays 12–3 🌯', platforms: ['Facebook', 'Google Business'], media: '🌯', status: 'Scheduled', scheduledAt: at(0, 11), author: 'Mehak (Marketing)', campaign: 'Lunch Rush', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-5', caption: 'Mango Lassi season is almost over — last call! 🥭', platforms: ['Instagram', 'TikTok'], media: '🥭', status: 'Pending', scheduledAt: at(1, 16), author: 'AI Content Studio', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-6', caption: 'Meet Chef Asif — 20 years of mastering the perfect biryani dum.', platforms: ['Instagram', 'Facebook'], media: '👨‍🍳', status: 'Scheduled', scheduledAt: at(2, 18), author: 'Ali (Brand)', campaign: 'Faces of Spice Route', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-7', caption: 'Double points weekend for Spice Club members 💎', platforms: ['Instagram', 'Facebook', 'X'], media: '💎', status: 'Pending', scheduledAt: at(3, 12), author: 'AI Content Studio', campaign: 'Loyalty Boost', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-8', caption: 'Sunday family feast: kids eat free at all branches 👨‍👩‍👧', platforms: ['Facebook', 'Google Business'], media: '🍛', status: 'Scheduled', scheduledAt: at(4, 10), author: 'Mehak (Marketing)', campaign: 'Family Sundays', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-9', caption: 'Rate your last visit and win a dinner for two ⭐', platforms: ['Google Business'], media: '⭐', status: 'Draft', scheduledAt: at(5, 15), author: 'Ali (Brand)', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-10', caption: 'POV: you ordered the Seekh Kebab Platter 😮‍💨', platforms: ['TikTok'], media: '🍢', status: 'Scheduled', scheduledAt: at(6, 20), author: 'Mehak (Marketing)', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-11', caption: '50% off everything!!! today only', platforms: ['Instagram'], media: '💸', status: 'Rejected', scheduledAt: at(-4, 12), author: 'Intern', likes: 0, comments: 0, shares: 0, reach: 0 },
  { id: 'SP-12', caption: 'Airport branch now open 24/7 ✈️ Grab a Kashmiri chai before boarding.', platforms: ['Instagram', 'Facebook', 'Google Business', 'X'], media: '✈️', status: 'Published', scheduledAt: at(-5, 9), author: 'Ali (Brand)', likes: 1560, comments: 88, shares: 120, reach: 22800 },
]

const campaigns: Campaign[] = [
  { id: 'CMP-1', name: 'Karahi Fridays', objective: 'Footfall', platforms: ['Instagram', 'Facebook'], budget: 1200, spent: 860, reach: 182000, clicks: 6400, conversions: 412, status: 'Active', startsAt: daysFromNow(-20), endsAt: daysFromNow(10) },
  { id: 'CMP-2', name: 'New Menu Launch', objective: 'Awareness', platforms: ['Instagram', 'TikTok', 'X'], budget: 2000, spent: 1240, reach: 310000, clicks: 9800, conversions: 286, status: 'Active', startsAt: daysFromNow(-5), endsAt: daysFromNow(25) },
  { id: 'CMP-3', name: 'Lunch Rush', objective: 'Orders', platforms: ['Facebook', 'Google Business'], budget: 800, spent: 420, reach: 64000, clicks: 3100, conversions: 540, status: 'Active', startsAt: daysFromNow(-12), endsAt: daysFromNow(18) },
  { id: 'CMP-4', name: 'Loyalty Boost', objective: 'Engagement', platforms: ['Instagram', 'Facebook'], budget: 500, spent: 0, reach: 0, clicks: 0, conversions: 0, status: 'Scheduled', startsAt: daysFromNow(3), endsAt: daysFromNow(10) },
  { id: 'CMP-5', name: 'Faces of Spice Route', objective: 'Engagement', platforms: ['Instagram', 'Facebook', 'TikTok'], budget: 600, spent: 90, reach: 12000, clicks: 420, conversions: 18, status: 'Active', startsAt: daysFromNow(-1), endsAt: daysFromNow(29) },
  { id: 'CMP-6', name: 'Ramadan Iftar Specials', objective: 'Orders', platforms: ['Instagram', 'Facebook', 'Google Business'], budget: 3000, spent: 2980, reach: 540000, clicks: 21400, conversions: 2380, status: 'Completed', startsAt: daysFromNow(-200), endsAt: daysFromNow(-170) },
  { id: 'CMP-7', name: 'Family Sundays', objective: 'Footfall', platforms: ['Facebook', 'Google Business'], budget: 700, spent: 0, reach: 0, clicks: 0, conversions: 0, status: 'Draft', startsAt: daysFromNow(4), endsAt: daysFromNow(60) },
]

export const engagementTrend = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86_400_000)
  return {
    d: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Instagram: Math.round(3200 + Math.sin(i / 2) * 900 + i * 120),
    Facebook: Math.round(1800 + Math.cos(i / 3) * 400 + i * 40),
    TikTok: Math.round(2400 + Math.sin(i / 1.5) * 1400 + i * 260),
  }
})

const aiCaptions: string[] = [
  '🔥 Slow-cooked, wok-tossed, absolutely unforgettable. Our Chicken Karahi is calling your name tonight — reserve at Downtown, Mall Road or Airport. #SpiceRoute #KarahiNights #LahoreEats',
  'Dough → tandoor → golden perfection in 90 seconds 🫓✨ Tag the friend who always orders extra naan. #BehindTheTandoor #SpiceRouteKitchen',
  'Your lunch break just got an upgrade 🌯 Chicken Tikka Wrap + drink for $7.99, weekdays 12–3. Order on our app, Foodpanda or walk in! #LunchDeal #SpiceRoute',
  'Spice Club members: it’s DOUBLE POINTS weekend 💎 Every bite brings you closer to a chef’s table for two. #SpiceClub #EatAndEarn',
  'Saffron. Aged basmati. Eight hours of dum. 🍛 This is what patience tastes like — Mutton Biryani, only at Spice Route Kitchen.',
]

export const getSocialAccounts = () => request<SocialAccount[]>('/marketing/social-accounts', socialAccounts)
export const connectSocialAccount = (a: SocialAccount) => mutate(`/marketing/social-accounts/${a.platform}`, 'PUT', a)
export const getSocialPosts = () => request<SocialPost[]>('/marketing/posts', socialPosts)
export const createSocialPost = (p: SocialPost) => mutate('/marketing/posts', 'POST', p)
export const updateSocialPost = (p: SocialPost) => mutate(`/marketing/posts/${p.id}`, 'PATCH', p)
export const getCampaigns = () => request<Campaign[]>('/marketing/campaigns', campaigns)
export const createCampaign = (c: Campaign) => mutate('/marketing/campaigns', 'POST', c)
let captionCursor = 0
const captionKeywords: [RegExp, number][] = [
  [/karahi|dinner|friday|table/i, 0],
  [/naan|tandoor|behind|kitchen/i, 1],
  [/lunch|wrap|deal|office/i, 2],
  [/point|loyal|member|club/i, 3],
  [/biryani|rice|saffron/i, 4],
]
/** AI Content Generation — returns a canned caption after a short "thinking" delay in mock mode. */
export const generateCaption = (topic: string) =>
  new Promise<string>((resolve) =>
    setTimeout(() => {
      const hit = captionKeywords.find(([re]) => re.test(topic))
      const idx = hit && captionCursor % 2 === 0 ? hit[1] : captionCursor % aiCaptions.length
      captionCursor++
      resolve(aiCaptions[idx])
    }, 1100),
  )

/* ════════════════════════════ Finance & Accounting ════════════════════════════ */

export interface Transaction {
  id: string
  date: string
  type: 'Sale' | 'Refund' | 'Settlement' | 'Expense'
  description: string
  method: 'Cash' | 'Card' | 'Wallet' | 'Foodpanda' | 'Careem' | 'Bank'
  branch: Branch
  amount: number
  status: 'Completed' | 'Pending' | 'Failed'
}

export interface Expense {
  id: string
  date: string
  category: string
  vendor: string
  branch: Branch
  amount: number
  status: 'Paid' | 'Pending' | 'Approved'
}

export interface Settlement {
  id: string
  provider: string
  period: string
  gross: number
  commission: number
  net: number
  expectedAt: string
  status: 'Received' | 'Pending' | 'Overdue'
}

export interface PayrollInput {
  id: string
  employee: string
  role: string
  branch: Branch
  hours: number
  overtime: number
  rate: number
  tips: number
  status: 'Approved' | 'Pending'
}

export interface Invoice {
  id: string
  party: string
  type: 'Receivable' | 'Payable'
  issued: string
  due: string
  subtotal: number
  tax: number
  status: 'Paid' | 'Sent' | 'Overdue' | 'Draft'
  reconciled: boolean
}

export interface PnLLine {
  label: string
  current: number
  previous: number
  group: 'Revenue' | 'COGS' | 'Gross' | 'Opex' | 'Net'
  bold?: boolean
}

export interface FinanceAnomaly {
  id: string
  title: string
  detail: string
  amount: number
  severity: 'critical' | 'warning' | 'info'
  detectedAt: string
  status: 'Open' | 'Resolved'
}

export const revenueExpenseTrend = [
  { m: 'Apr', revenue: 182000, expenses: 141000 },
  { m: 'May', revenue: 191500, expenses: 146200 },
  { m: 'Jun', revenue: 176400, expenses: 139800 },
  { m: 'Jul', revenue: 204300, expenses: 152600 },
  { m: 'Aug', revenue: 212800, expenses: 158100 },
  { m: 'Sep', revenue: 221600, expenses: 162400 },
]

export const revenueByChannel = [
  { name: 'Dine-in', value: 119700 },
  { name: 'Delivery', value: 68700 },
  { name: 'Takeaway', value: 22200 },
  { name: 'Online / QR', value: 11000 },
]

export const forecastSeries = [
  { d: 'W32', actual: 48200 },
  { d: 'W33', actual: 49800 },
  { d: 'W34', actual: 47600 },
  { d: 'W35', actual: 51200 },
  { d: 'W36', actual: 52900 },
  { d: 'W37', actual: 50400 },
  { d: 'W38', actual: 54100, forecast: 54100, band: [54100, 54100] as [number, number] },
  { d: 'W39', forecast: 55600, band: [52400, 58700] as [number, number] },
  { d: 'W40', forecast: 57200, band: [53100, 61300] as [number, number] },
  { d: 'W41', forecast: 56100, band: [51400, 60800] as [number, number] },
  { d: 'W42', forecast: 58900, band: [53300, 64500] as [number, number] },
  { d: 'W43', forecast: 61400, band: [55000, 67800] as [number, number] },
]

const txDescs: [Transaction['type'], string, Transaction['method'], number][] = [
  ['Sale', 'Table 12 — dinner', 'Card', 86.4],
  ['Sale', 'Order #58213 delivery', 'Foodpanda', 32.5],
  ['Refund', 'Double charge — James Wilson', 'Card', -24.9],
  ['Sale', 'Table 4 — lunch', 'Cash', 41.2],
  ['Settlement', 'Foodpanda weekly payout', 'Bank', 7840],
  ['Expense', 'K-Electric bill', 'Bank', -1260],
  ['Sale', 'QR order — Table 7', 'Wallet', 28.75],
  ['Sale', 'Catering — Systems Ltd', 'Bank', 1450],
  ['Refund', 'Missing items — Kamran Akmal', 'Foodpanda', -12.5],
  ['Sale', 'Takeaway #58219', 'Cash', 19.8],
  ['Settlement', 'Careem weekly payout', 'Bank', 2410],
  ['Expense', 'Gas cylinders refill', 'Cash', -186],
  ['Sale', 'Table 9 — family dinner', 'Card', 132.6],
  ['Sale', 'Order #58224 app', 'Wallet', 45.3],
  ['Refund', 'Cold food complaint', 'Wallet', -18],
  ['Sale', 'Airport counter batch', 'Card', 642.1],
  ['Expense', 'Deep cleaning service', 'Bank', -320],
  ['Sale', 'Uber Eats test order', 'Card', 15.5],
]
const transactions: Transaction[] = txDescs.map(([type, description, method, amount], i) => ({
  id: `TX-${90410 + i}`,
  date: minutesAgo(i * 95 + 12),
  type,
  description,
  method,
  branch: BRANCHES[i % 3],
  amount,
  status: i === 14 ? 'Pending' : i === 17 ? 'Failed' : 'Completed',
}))

const expenses: Expense[] = [
  { id: 'EX-1', date: daysFromNow(-1), category: 'Food & Ingredients', vendor: 'Al-Fatah Meats', branch: 'Downtown', amount: 5620, status: 'Pending' },
  { id: 'EX-2', date: daysFromNow(-2), category: 'Utilities', vendor: 'K-Electric', branch: 'Downtown', amount: 1260, status: 'Paid' },
  { id: 'EX-3', date: daysFromNow(-2), category: 'Rent', vendor: 'Packages Mall', branch: 'Mall Road', amount: 9500, status: 'Paid' },
  { id: 'EX-4', date: daysFromNow(-3), category: 'Food & Ingredients', vendor: 'Metro Foods', branch: 'Mall Road', amount: 3240, status: 'Approved' },
  { id: 'EX-5', date: daysFromNow(-4), category: 'Marketing', vendor: 'Meta Ads', branch: 'Downtown', amount: 860, status: 'Paid' },
  { id: 'EX-6', date: daysFromNow(-4), category: 'Maintenance', vendor: 'CoolTech HVAC', branch: 'Airport', amount: 740, status: 'Pending' },
  { id: 'EX-7', date: daysFromNow(-5), category: 'Packaging', vendor: 'EcoPack Solutions', branch: 'Airport', amount: 1450, status: 'Approved' },
  { id: 'EX-8', date: daysFromNow(-6), category: 'Utilities', vendor: 'SNGPL Gas', branch: 'Mall Road', amount: 680, status: 'Paid' },
  { id: 'EX-9', date: daysFromNow(-7), category: 'Software', vendor: 'RestaurantOS', branch: 'Downtown', amount: 299, status: 'Paid' },
  { id: 'EX-10', date: daysFromNow(-8), category: 'Cleaning', vendor: 'CleanPro Hygiene', branch: 'Downtown', amount: 320, status: 'Paid' },
  { id: 'EX-11', date: daysFromNow(-9), category: 'Rent', vendor: 'Allama Iqbal Intl Airport', branch: 'Airport', amount: 12000, status: 'Paid' },
  { id: 'EX-12', date: daysFromNow(-10), category: 'Food & Ingredients', vendor: 'Green Valley Produce', branch: 'Airport', amount: 980, status: 'Paid' },
]

export const expenseByCategory = [
  { name: 'Food & Ingredients', value: 58400 },
  { name: 'Payroll', value: 46200 },
  { name: 'Rent', value: 31500 },
  { name: 'Utilities', value: 9800 },
  { name: 'Marketing', value: 6200 },
  { name: 'Other', value: 10300 },
]

const settlements: Settlement[] = [
  { id: 'ST-1', provider: 'Foodpanda', period: 'Sep 29 – Oct 5', gross: 9420, commission: 1580, net: 7840, expectedAt: daysFromNow(-1), status: 'Received' },
  { id: 'ST-2', provider: 'Careem', period: 'Sep 29 – Oct 5', gross: 2890, commission: 480, net: 2410, expectedAt: daysFromNow(-1), status: 'Received' },
  { id: 'ST-3', provider: 'Stripe (Cards)', period: 'Oct 8', gross: 4260, commission: 123.5, net: 4136.5, expectedAt: daysFromNow(1), status: 'Pending' },
  { id: 'ST-4', provider: 'JazzCash Wallet', period: 'Oct 1 – Oct 7', gross: 1840, commission: 27.6, net: 1812.4, expectedAt: daysFromNow(-3), status: 'Overdue' },
  { id: 'ST-5', provider: 'Foodpanda', period: 'Oct 6 – Oct 12', gross: 8120, commission: 1360, net: 6760, expectedAt: daysFromNow(4), status: 'Pending' },
  { id: 'ST-6', provider: 'Uber Eats', period: 'Oct 1 – Oct 7', gross: 0, commission: 0, net: 0, expectedAt: daysFromNow(2), status: 'Pending' },
]

const payroll: PayrollInput[] = [
  { id: 'PY-1', employee: 'Asif Mehmood', role: 'Head Chef', branch: 'Downtown', hours: 176, overtime: 12, rate: 9.5, tips: 0, status: 'Approved' },
  { id: 'PY-2', employee: 'Maria D’Souza', role: 'Sous Chef', branch: 'Downtown', hours: 168, overtime: 8, rate: 7.2, tips: 0, status: 'Approved' },
  { id: 'PY-3', employee: 'Ahsan Iqbal', role: 'Server', branch: 'Mall Road', hours: 160, overtime: 14, rate: 3.8, tips: 214, status: 'Pending' },
  { id: 'PY-4', employee: 'Zain Abbas', role: 'Branch Manager', branch: 'Airport', hours: 180, overtime: 0, rate: 8.5, tips: 0, status: 'Approved' },
  { id: 'PY-5', employee: 'Hassan Raza', role: 'Line Cook', branch: 'Mall Road', hours: 172, overtime: 18, rate: 4.4, tips: 0, status: 'Pending' },
  { id: 'PY-6', employee: 'Sadia Noor', role: 'Cashier', branch: 'Downtown', hours: 152, overtime: 2, rate: 3.6, tips: 48, status: 'Approved' },
  { id: 'PY-7', employee: 'Kevin Joseph', role: 'Rider', branch: 'Airport', hours: 164, overtime: 22, rate: 3.2, tips: 176, status: 'Pending' },
  { id: 'PY-8', employee: 'Omar Sheikh', role: 'Branch Manager', branch: 'Mall Road', hours: 180, overtime: 4, rate: 8.5, tips: 0, status: 'Approved' },
]

const invoices: Invoice[] = [
  { id: 'INV-24091', party: 'Systems Ltd (Catering)', type: 'Receivable', issued: daysFromNow(-12), due: daysFromNow(3), subtotal: 1450, tax: 232, status: 'Sent', reconciled: false },
  { id: 'INV-24090', party: 'Arbisoft (Corporate Lunch)', type: 'Receivable', issued: daysFromNow(-35), due: daysFromNow(-5), subtotal: 2940, tax: 470.4, status: 'Overdue', reconciled: false },
  { id: 'AFM-22841', party: 'Al-Fatah Meats', type: 'Payable', issued: daysFromNow(-9), due: daysFromNow(-2), subtotal: 5620, tax: 0, status: 'Overdue', reconciled: false },
  { id: 'MF-10932', party: 'Metro Foods', type: 'Payable', issued: daysFromNow(-26), due: daysFromNow(4), subtotal: 2793, tax: 447, status: 'Sent', reconciled: true },
  { id: 'INV-24089', party: 'PIA Lounge Services', type: 'Receivable', issued: daysFromNow(-20), due: daysFromNow(-1), subtotal: 3800, tax: 608, status: 'Paid', reconciled: true },
  { id: 'CB-9912', party: 'Crystal Beverages', type: 'Payable', issued: daysFromNow(-30), due: daysFromNow(-6), subtotal: 1069, tax: 171, status: 'Paid', reconciled: true },
  { id: 'INV-24092', party: 'Wedding — Butt family', type: 'Receivable', issued: daysFromNow(-1), due: daysFromNow(14), subtotal: 6200, tax: 992, status: 'Draft', reconciled: false },
  { id: 'DF-7730', party: 'Dairy Fresh', type: 'Payable', issued: daysFromNow(-9), due: daysFromNow(6), subtotal: 1629, tax: 261, status: 'Sent', reconciled: false },
  { id: 'INV-24088', party: 'Netsol (Team dinner)', type: 'Receivable', issued: daysFromNow(-40), due: daysFromNow(-10), subtotal: 1180, tax: 188.8, status: 'Paid', reconciled: true },
]

export const taxSummary = [
  { label: 'Sales tax collected (16%)', value: 35456 },
  { label: 'Input tax on purchases', value: -9310 },
  { label: 'Withholding tax deducted', value: -2140 },
  { label: 'Net tax payable (Sep)', value: 24006 },
]

const pnl: PnLLine[] = [
  { label: 'Food sales', current: 184200, previous: 176300, group: 'Revenue' },
  { label: 'Beverage sales', current: 27400, previous: 25900, group: 'Revenue' },
  { label: 'Catering & events', current: 10000, previous: 10600, group: 'Revenue' },
  { label: 'Total revenue', current: 221600, previous: 212800, group: 'Revenue', bold: true },
  { label: 'Food cost', current: 58400, previous: 57200, group: 'COGS' },
  { label: 'Beverage cost', current: 6900, previous: 6500, group: 'COGS' },
  { label: 'Packaging', current: 4100, previous: 3900, group: 'COGS' },
  { label: 'Gross profit', current: 152200, previous: 145200, group: 'Gross', bold: true },
  { label: 'Payroll & benefits', current: 46200, previous: 45100, group: 'Opex' },
  { label: 'Rent', current: 31500, previous: 31500, group: 'Opex' },
  { label: 'Utilities', current: 9800, previous: 10400, group: 'Opex' },
  { label: 'Marketing', current: 6200, previous: 5400, group: 'Opex' },
  { label: 'Aggregator commissions', current: 4300, previous: 4100, group: 'Opex' },
  { label: 'Repairs & other', current: 5900, previous: 5800, group: 'Opex' },
  { label: 'Net operating profit', current: 48300, previous: 42900, group: 'Net', bold: true },
]

const anomalies: FinanceAnomaly[] = [
  { id: 'AN-1', title: 'Refunds spike at Airport', detail: '7 refunds ($182) in 2 hours by the same cashier login — 4.6× normal rate.', amount: 182, severity: 'critical', detectedAt: minutesAgo(48), status: 'Open' },
  { id: 'AN-2', title: 'Duplicate supplier invoice', detail: 'Al-Fatah Meats AFM-22841 matches AFM-22839 amount & lines.', amount: 5620, severity: 'warning', detectedAt: minutesAgo(300), status: 'Open' },
  { id: 'AN-3', title: 'Utility bill +38% at Downtown', detail: 'K-Electric bill above 6-month band; walk-in freezer drawing extra power.', amount: 1260, severity: 'warning', detectedAt: minutesAgo(1500), status: 'Open' },
  { id: 'AN-4', title: 'Cash drawer variance', detail: 'Mall Road evening shift short by $42 — within tolerance after recount.', amount: 42, severity: 'info', detectedAt: minutesAgo(2900), status: 'Resolved' },
]

export const getTransactions = () => request<Transaction[]>('/finance/transactions', transactions)
export const getExpenses = () => request<Expense[]>('/finance/expenses', expenses)
export const createExpense = (e: Expense) => mutate('/finance/expenses', 'POST', e)
export const getSettlements = () => request<Settlement[]>('/finance/settlements', settlements)
export const getPayrollInputs = () => request<PayrollInput[]>('/finance/payroll-inputs', payroll)
export const getInvoices = () => request<Invoice[]>('/finance/invoices', invoices)
export const updateInvoice = (i: Invoice) => mutate(`/finance/invoices/${i.id}`, 'PATCH', i)
export const getPnL = () => request<PnLLine[]>('/finance/pnl', pnl)
export const getFinanceAnomalies = () => request<FinanceAnomaly[]>('/ai/finance/anomalies', anomalies)
export const issueRefund = (t: Transaction) => mutate('/finance/refunds', 'POST', t)

/* ════════════════════════════ Quality, Safety & Compliance ════════════════════════════ */

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  critical?: boolean
}

export interface SafetyChecklist {
  id: string
  name: string
  shift: 'Opening' | 'Mid-day' | 'Closing'
  branch: Branch
  owner: string
  dueAt: string
  items: ChecklistItem[]
}

export interface TempSensor {
  id: string
  name: string
  type: 'Fridge' | 'Freezer' | 'Hot holding' | 'Cold room'
  branch: Branch
  current: number
  min: number
  max: number
  history: number[]
  battery: number
  lastReading: string
}

export interface ExpiryItem {
  id: string
  item: string
  batch: string
  branch: Branch
  location: string
  qty: string
  expiresAt: string
}

export interface CleaningRecord {
  id: string
  area: string
  task: string
  branch: Branch
  frequency: 'Hourly' | 'Daily' | 'Weekly' | 'Monthly'
  doneBy: string
  verifiedBy?: string
  at: string
  status: 'Completed' | 'Pending' | 'Overdue'
}

export interface Inspection {
  id: string
  type: 'Internal' | 'Punjab Food Authority' | 'Fire Safety' | 'Third-party'
  branch: Branch
  inspector: string
  date: string
  score: number
  findings: number
  status: 'Passed' | 'Failed' | 'Scheduled'
}

export interface Incident {
  id: string
  title: string
  type: 'Foodborne illness' | 'Injury' | 'Allergen' | 'Pest' | 'Recall' | 'Equipment'
  branch: Branch
  severity: 'Low' | 'Medium' | 'High' | 'Critical'
  reportedBy: string
  reportedAt: string
  status: 'Open' | 'In Progress' | 'Resolved'
  actions: string
}

export interface License {
  id: string
  name: string
  authority: string
  branch: Branch | 'All'
  number: string
  issued: string
  expires: string
}

const checklists: SafetyChecklist[] = [
  {
    id: 'CL-1', name: 'Opening Food Safety Check', shift: 'Opening', branch: 'Downtown', owner: 'Sara Ahmed', dueAt: minutesAgo(-30),
    items: [
      { id: 'a', label: 'Hand-wash stations stocked (soap, towels, sanitizer)', done: true, critical: true },
      { id: 'b', label: 'Fridge & freezer temps logged', done: true, critical: true },
      { id: 'c', label: 'Prep surfaces sanitised (200 ppm)', done: true },
      { id: 'd', label: 'Staff health declaration signed', done: false, critical: true },
      { id: 'e', label: 'Colour-coded boards in place', done: true },
      { id: 'f', label: 'Pest traps inspected', done: false },
      { id: 'g', label: 'Allergen matrix displayed at pass', done: true },
    ],
  },
  {
    id: 'CL-2', name: 'Mid-day Hygiene Round', shift: 'Mid-day', branch: 'Mall Road', owner: 'Omar Sheikh', dueAt: minutesAgo(-120),
    items: [
      { id: 'a', label: 'Hot-holding ≥ 63°C verified', done: true, critical: true },
      { id: 'b', label: 'Bins emptied & lids closed', done: false },
      { id: 'c', label: 'Gloves changed between raw & cooked', done: true, critical: true },
      { id: 'd', label: 'Customer washrooms checked', done: false },
      { id: 'e', label: 'Date labels on all prepped items', done: true },
    ],
  },
  {
    id: 'CL-3', name: 'Closing Kitchen Shutdown', shift: 'Closing', branch: 'Airport', owner: 'Zain Abbas', dueAt: minutesAgo(-480),
    items: [
      { id: 'a', label: 'All food covered, labelled & stored', done: false, critical: true },
      { id: 'b', label: 'Fryer oil filtered / changed', done: false },
      { id: 'c', label: 'Floors degreased and mopped', done: false },
      { id: 'd', label: 'Gas valves off', done: false, critical: true },
      { id: 'e', label: 'Waste log completed', done: false },
      { id: 'f', label: 'Final fridge temp reading', done: false, critical: true },
    ],
  },
]

function series(base: number, spread: number, n = 16, drift = 0) {
  return Array.from({ length: n }, (_, i) => Math.round((base + Math.sin(i * 1.3) * spread + drift * i) * 10) / 10)
}

const sensors: TempSensor[] = [
  { id: 'TS-1', name: 'Walk-in Cooler', type: 'Cold room', branch: 'Downtown', current: 3.2, min: 0, max: 5, history: series(3, 0.6), battery: 88, lastReading: minutesAgo(1) },
  { id: 'TS-2', name: 'Meat Freezer', type: 'Freezer', branch: 'Downtown', current: -14.1, min: -25, max: -18, history: series(-19, 0.8, 16, 0.32), battery: 64, lastReading: minutesAgo(1) },
  { id: 'TS-3', name: 'Dairy Fridge', type: 'Fridge', branch: 'Downtown', current: 4.1, min: 0, max: 5, history: series(3.8, 0.5), battery: 92, lastReading: minutesAgo(2) },
  { id: 'TS-4', name: 'Prep Line Fridge', type: 'Fridge', branch: 'Mall Road', current: 6.8, min: 0, max: 5, history: series(4.5, 0.7, 16, 0.15), battery: 71, lastReading: minutesAgo(1) },
  { id: 'TS-5', name: 'Seafood Freezer', type: 'Freezer', branch: 'Mall Road', current: -21.4, min: -25, max: -18, history: series(-21, 0.7), battery: 55, lastReading: minutesAgo(3) },
  { id: 'TS-6', name: 'Bain-marie (Curries)', type: 'Hot holding', branch: 'Mall Road', current: 68.5, min: 63, max: 85, history: series(69, 2.2), battery: 100, lastReading: minutesAgo(1) },
  { id: 'TS-7', name: 'Beverage Chiller', type: 'Fridge', branch: 'Airport', current: 2.9, min: 0, max: 5, history: series(3.1, 0.4), battery: 18, lastReading: minutesAgo(4) },
  { id: 'TS-8', name: 'Main Freezer', type: 'Freezer', branch: 'Airport', current: -19.6, min: -25, max: -18, history: series(-20, 0.6), battery: 79, lastReading: minutesAgo(1) },
]

const expiry: ExpiryItem[] = [
  { id: 'EXP-1', item: 'Fresh Cream', batch: 'DF-1009', branch: 'Downtown', location: 'Dairy Fridge', qty: '4 L', expiresAt: daysFromNow(0.3) },
  { id: 'EXP-2', item: 'Yogurt', batch: 'DF-0998', branch: 'Mall Road', location: 'Prep Line Fridge', qty: '6 kg', expiresAt: daysFromNow(1) },
  { id: 'EXP-3', item: 'Marinated Chicken Tikka', batch: 'IH-1010-A', branch: 'Downtown', location: 'Walk-in Cooler', qty: '12 kg', expiresAt: daysFromNow(1.5) },
  { id: 'EXP-4', item: 'Mint Chutney', batch: 'IH-1009-C', branch: 'Airport', location: 'Beverage Chiller', qty: '3 L', expiresAt: daysFromNow(-0.5) },
  { id: 'EXP-5', item: 'Paneer', batch: 'DF-1002', branch: 'Mall Road', location: 'Prep Line Fridge', qty: '5 kg', expiresAt: daysFromNow(2) },
  { id: 'EXP-6', item: 'Tiger Prawns', batch: 'OC-0921', branch: 'Mall Road', location: 'Seafood Freezer', qty: '8 kg', expiresAt: daysFromNow(21) },
  { id: 'EXP-7', item: 'Cooked Biryani Rice', batch: 'IH-1010-B', branch: 'Airport', location: 'Main Freezer', qty: '9 kg', expiresAt: daysFromNow(2.5) },
  { id: 'EXP-8', item: 'Eggs (tray)', batch: 'DF-0995', branch: 'Downtown', location: 'Walk-in Cooler', qty: '6 trays', expiresAt: daysFromNow(5) },
]

const cleaningRecords: CleaningRecord[] = [
  { id: 'CR-1', area: 'Tandoor station', task: 'Ash removal & exterior wipe', branch: 'Downtown', frequency: 'Daily', doneBy: 'Hassan Raza', verifiedBy: 'Sara Ahmed', at: minutesAgo(120), status: 'Completed' },
  { id: 'CR-2', area: 'Extraction hoods', task: 'Grease filter degrease', branch: 'Mall Road', frequency: 'Weekly', doneBy: 'CleanPro team', verifiedBy: 'Omar Sheikh', at: minutesAgo(1600), status: 'Completed' },
  { id: 'CR-3', area: 'Customer washrooms', task: 'Hourly check & restock', branch: 'Airport', frequency: 'Hourly', doneBy: 'Imtiaz', at: minutesAgo(95), status: 'Overdue' },
  { id: 'CR-4', area: 'Walk-in cooler', task: 'Shelves sanitise & FIFO rotate', branch: 'Downtown', frequency: 'Weekly', doneBy: 'Maria D’Souza', verifiedBy: 'Asif Mehmood', at: minutesAgo(4300), status: 'Completed' },
  { id: 'CR-5', area: 'Dining floor', task: 'Tables & chairs sanitise', branch: 'Mall Road', frequency: 'Daily', doneBy: 'Ahsan Iqbal', at: minutesAgo(30), status: 'Pending' },
  { id: 'CR-6', area: 'Grease trap', task: 'Pump-out & inspection', branch: 'Airport', frequency: 'Monthly', doneBy: 'Waste Busters', verifiedBy: 'Zain Abbas', at: minutesAgo(30000), status: 'Completed' },
  { id: 'CR-7', area: 'Prep sinks', task: 'Descale & sanitise', branch: 'Downtown', frequency: 'Daily', doneBy: 'Sadia Noor', at: minutesAgo(1500), status: 'Overdue' },
  { id: 'CR-8', area: 'Delivery bags', task: 'Interior sanitise', branch: 'Airport', frequency: 'Daily', doneBy: 'Kevin Joseph', verifiedBy: 'Zain Abbas', at: minutesAgo(400), status: 'Completed' },
]

const inspections: Inspection[] = [
  { id: 'INS-1', type: 'Punjab Food Authority', branch: 'Downtown', inspector: 'PFA Team B', date: daysFromNow(-24), score: 94, findings: 2, status: 'Passed' },
  { id: 'INS-2', type: 'Internal', branch: 'Mall Road', inspector: 'Sara Ahmed', date: daysFromNow(-6), score: 81, findings: 5, status: 'Passed' },
  { id: 'INS-3', type: 'Fire Safety', branch: 'Airport', inspector: 'Rescue 1122', date: daysFromNow(-48), score: 72, findings: 4, status: 'Failed' },
  { id: 'INS-4', type: 'Third-party', branch: 'Airport', inspector: 'SGS Pakistan', date: daysFromNow(9), score: 0, findings: 0, status: 'Scheduled' },
  { id: 'INS-5', type: 'Internal', branch: 'Downtown', inspector: 'Omar Sheikh', date: daysFromNow(-2), score: 89, findings: 3, status: 'Passed' },
  { id: 'INS-6', type: 'Punjab Food Authority', branch: 'Mall Road', inspector: 'PFA Team A', date: daysFromNow(14), score: 0, findings: 0, status: 'Scheduled' },
]

const incidents: Incident[] = [
  { id: 'INC-41', title: 'Customer reported nut allergy reaction', type: 'Allergen', branch: 'Mall Road', severity: 'High', reportedBy: 'Omar Sheikh', reportedAt: minutesAgo(2600), status: 'In Progress', actions: 'Allergen matrix re-trained; korma recipe re-labelled.' },
  { id: 'INC-40', title: 'Supplier recall — Dairy Fresh cream batch DF-0987', type: 'Recall', branch: 'Downtown', severity: 'Critical', reportedBy: 'System (supplier feed)', reportedAt: minutesAgo(4800), status: 'Resolved', actions: '14 L quarantined & returned; no dishes served from batch.' },
  { id: 'INC-39', title: 'Line cook minor burn at tandoor', type: 'Injury', branch: 'Downtown', severity: 'Low', reportedBy: 'Asif Mehmood', reportedAt: minutesAgo(7200), status: 'Resolved', actions: 'First aid given; heat-gloves replaced.' },
  { id: 'INC-38', title: 'Cockroach sighting near dish pit', type: 'Pest', branch: 'Airport', severity: 'Medium', reportedBy: 'Zain Abbas', reportedAt: minutesAgo(1200), status: 'Open', actions: 'Pest control visit booked for tonight.' },
  { id: 'INC-37', title: 'Prep fridge compressor failure', type: 'Equipment', branch: 'Mall Road', severity: 'High', reportedBy: 'Sensor TS-4', reportedAt: minutesAgo(40), status: 'Open', actions: 'Stock moved to walk-in; technician dispatched.' },
  { id: 'INC-36', title: '2 guests reported stomach upset', type: 'Foodborne illness', branch: 'Airport', severity: 'Medium', reportedBy: 'Guest relations', reportedAt: minutesAgo(15000), status: 'Resolved', actions: 'Batch samples tested negative; closed with PFA notice.' },
]

const licenses: License[] = [
  { id: 'LIC-1', name: 'Punjab Food Authority License', authority: 'PFA', branch: 'Downtown', number: 'PFA-LHR-2291', issued: daysFromNow(-330), expires: daysFromNow(35) },
  { id: 'LIC-2', name: 'Punjab Food Authority License', authority: 'PFA', branch: 'Mall Road', number: 'PFA-LHR-3384', issued: daysFromNow(-200), expires: daysFromNow(165) },
  { id: 'LIC-3', name: 'Punjab Food Authority License', authority: 'PFA', branch: 'Airport', number: 'PFA-LHR-4102', issued: daysFromNow(-375), expires: daysFromNow(-10) },
  { id: 'LIC-4', name: 'Fire Safety Certificate', authority: 'Rescue 1122', branch: 'Airport', number: 'FS-88120', issued: daysFromNow(-300), expires: daysFromNow(12) },
  { id: 'LIC-5', name: 'Trade License', authority: 'LMC', branch: 'All', number: 'TL-2024-1188', issued: daysFromNow(-280), expires: daysFromNow(85) },
  { id: 'LIC-6', name: 'Halal Certification', authority: 'PHA', branch: 'All', number: 'HAL-PK-5521', issued: daysFromNow(-90), expires: daysFromNow(275) },
  { id: 'LIC-7', name: 'Staff Medical Certificates (32)', authority: 'PFA', branch: 'All', number: '32 staff', issued: daysFromNow(-160), expires: daysFromNow(22) },
  { id: 'LIC-8', name: 'Signboard Permit', authority: 'PHA Lahore', branch: 'Mall Road', number: 'SB-7731', issued: daysFromNow(-500), expires: daysFromNow(230) },
]

export const getChecklists = () => request<SafetyChecklist[]>('/compliance/checklists', checklists)
export const updateChecklist = (c: SafetyChecklist) => mutate(`/compliance/checklists/${c.id}`, 'PUT', c)
export const getSensors = () => request<TempSensor[]>('/compliance/sensors', sensors)
export const getExpiryItems = () => request<ExpiryItem[]>('/compliance/expiry', expiry)
export const getCleaningRecords = () => request<CleaningRecord[]>('/compliance/cleaning', cleaningRecords)
export const createCleaningRecord = (r: CleaningRecord) => mutate('/compliance/cleaning', 'POST', r)
export const getInspections = () => request<Inspection[]>('/compliance/inspections', inspections)
export const getIncidents = () => request<Incident[]>('/compliance/incidents', incidents)
export const createIncident = (i: Incident) => mutate('/compliance/incidents', 'POST', i)
export const getLicenses = () => request<License[]>('/compliance/licenses', licenses)

/* ════════════════════════════ Reports & BI ════════════════════════════ */

export interface ReportBundle {
  salesDaily: { d: string; dineIn: number; delivery: number; takeaway: number }[]
  hourly: { h: string; orders: number }[]
  topItems: { name: string; qty: number; revenue: number }[]
  foodCost: { category: string; cost: number; target: number; actual: number }[]
  wastage: { d: string; kg: number }[]
  inventoryValue: { name: string; value: number; turnover: number }[]
  staff: { name: string; role: string; branch: Branch; orders: number; avgTicket: number; rating: number; upsell: number }[]
  kitchen: { station: string; avgPrep: number; target: number; tickets: number }[]
  customerMix: { name: string; value: number }[]
  marketingRoi: { channel: string; spend: number; revenue: number }[]
  branches: { branch: Branch; revenue: number; cost: number; profit: number; margin: number; covers: number; rating: number; growth: number }[]
}

function salesDaily(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000)
    const weekend = d.getDay() === 5 || d.getDay() === 6 || d.getDay() === 0
    const k = weekend ? 1.35 : 1
    return {
      d: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dineIn: Math.round((3900 + Math.sin(i / 2) * 400) * k),
      delivery: Math.round((2300 + Math.cos(i / 3) * 300) * k),
      takeaway: Math.round((750 + Math.sin(i) * 120) * k),
    }
  })
}

export function buildReport(days: number): ReportBundle {
  const scale = days / 30
  return {
    salesDaily: salesDaily(Math.min(days, 30)),
    hourly: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'].map((h, i) => ({
      h: `${h}:00`,
      orders: Math.round([18, 46, 58, 34, 16, 14, 22, 40, 72, 88, 76, 44, 20][i] * Math.max(scale, 0.25) * 3),
    })),
    topItems: [
      { name: 'Chicken Karahi', qty: 1840, revenue: 26680 },
      { name: 'Mutton Biryani', qty: 1420, revenue: 22720 },
      { name: 'Butter Chicken', qty: 1310, revenue: 19650 },
      { name: 'Seekh Kebab Platter', qty: 980, revenue: 12740 },
      { name: 'Garlic Naan', qty: 4620, revenue: 11550 },
      { name: 'Chicken Tikka Wrap', qty: 1160, revenue: 8700 },
      { name: 'Mango Lassi', qty: 1520, revenue: 6080 },
    ].map((x) => ({ ...x, qty: Math.round(x.qty * scale), revenue: Math.round(x.revenue * scale) })),
    foodCost: [
      { category: 'Meat & Poultry', cost: 24600, target: 32, actual: 34.8 },
      { category: 'Rice & Grains', cost: 6200, target: 22, actual: 20.1 },
      { category: 'Dairy', cost: 7400, target: 26, actual: 27.5 },
      { category: 'Produce', cost: 5100, target: 18, actual: 16.9 },
      { category: 'Seafood', cost: 4800, target: 36, actual: 41.2 },
      { category: 'Beverages', cost: 2900, target: 20, actual: 18.4 },
    ].map((x) => ({ ...x, cost: Math.round(x.cost * scale) })),
    wastage: Array.from({ length: 14 }, (_, i) => ({ d: `D${i + 1}`, kg: Math.round((14 + Math.sin(i) * 4 - i * 0.3) * 10) / 10 })),
    inventoryValue: [
      { name: 'Downtown', value: 18400, turnover: 9.2 },
      { name: 'Mall Road', value: 15600, turnover: 10.4 },
      { name: 'Airport', value: 11200, turnover: 8.1 },
    ],
    staff: [
      { name: 'Ahsan Iqbal', role: 'Server', branch: 'Mall Road', orders: 412, avgTicket: 48.2, rating: 4.9, upsell: 31 },
      { name: 'Sadia Noor', role: 'Cashier', branch: 'Downtown', orders: 688, avgTicket: 26.4, rating: 4.7, upsell: 18 },
      { name: 'Bilal Khan', role: 'Server', branch: 'Downtown', orders: 376, avgTicket: 44.9, rating: 4.6, upsell: 27 },
      { name: 'Kevin Joseph', role: 'Rider', branch: 'Airport', orders: 298, avgTicket: 22.1, rating: 4.8, upsell: 0 },
      { name: 'Hira Shah', role: 'Server', branch: 'Airport', orders: 254, avgTicket: 39.5, rating: 4.4, upsell: 22 },
      { name: 'Faraz Ali', role: 'Server', branch: 'Mall Road', orders: 341, avgTicket: 41.0, rating: 4.2, upsell: 15 },
    ].map((s) => ({ ...s, branch: s.branch as Branch, orders: Math.round(s.orders * scale) })),
    kitchen: [
      { station: 'Tandoor', avgPrep: 7.2, target: 8, tickets: 2140 },
      { station: 'Karahi / Wok', avgPrep: 13.8, target: 12, tickets: 1810 },
      { station: 'Biryani & Rice', avgPrep: 4.1, target: 5, tickets: 1420 },
      { station: 'Grill', avgPrep: 11.2, target: 10, tickets: 980 },
      { station: 'Cold & Drinks', avgPrep: 2.6, target: 3, tickets: 2650 },
    ].map((k) => ({ ...k, tickets: Math.round(k.tickets * scale) })),
    customerMix: [
      { name: 'New', value: 28 },
      { name: 'Returning', value: 47 },
      { name: 'Loyalty members', value: 25 },
    ],
    marketingRoi: [
      { channel: 'Instagram', spend: 860, revenue: 7420 },
      { channel: 'Facebook', spend: 640, revenue: 4380 },
      { channel: 'TikTok', spend: 420, revenue: 5160 },
      { channel: 'Google', spend: 380, revenue: 3920 },
      { channel: 'SMS / WhatsApp', spend: 210, revenue: 2840 },
    ].map((m) => ({ ...m, spend: Math.round(m.spend * scale), revenue: Math.round(m.revenue * scale) })),
    branches: [
      { branch: 'Downtown' as Branch, revenue: 92400, cost: 71200, covers: 6120, rating: 4.6, growth: 6.2 },
      { branch: 'Mall Road' as Branch, revenue: 84800, cost: 62300, covers: 5480, rating: 4.7, growth: 11.4 },
      { branch: 'Airport' as Branch, revenue: 44400, cost: 39800, covers: 3910, rating: 4.3, growth: -2.1 },
    ].map((b) => {
      const revenue = Math.round(b.revenue * scale)
      const cost = Math.round(b.cost * scale)
      return { ...b, revenue, cost, profit: revenue - cost, margin: Math.round(((revenue - cost) / revenue) * 1000) / 10, covers: Math.round(b.covers * scale) }
    }),
  }
}

export const getReports = (days: number) => request<ReportBundle>(`/reports/summary?days=${days}`, buildReport(days))
export const exportReport = (name: string, format: 'PDF' | 'CSV' | 'Excel') => mutate('/reports/export', 'POST', { name, format })

/* ════════════════════════════ Central AI & Automation Engine ════════════════════════════ */

export interface AIModel {
  id: string
  name: string
  purpose: string
  icon: string
  accuracy: number
  lastTrained: string
  predictionsToday: number
  status: 'Active' | 'Training' | 'Degraded'
  sources: string[]
}

export interface AutomationRule {
  id: string
  name: string
  trigger: string
  condition: string
  action: string
  module: string
  enabled: boolean
  runs: number
  lastRun?: string
  requiresApproval: boolean
}

export interface LiveEvent {
  id: string
  at: string
  module: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'critical'
}

export interface PendingAction {
  id: string
  title: string
  detail: string
  module: string
  model: string
  confidence: number
  impact: string
  createdAt: string
}

export interface AuditLog {
  id: string
  at: string
  actor: string
  action: string
  module: string
  outcome: 'Approved' | 'Rejected' | 'Executed' | 'Failed'
}

export interface DataSource {
  module: string
  emoji: string
  records: number
  freshness: string
  status: 'Connected' | 'Degraded'
}

const aiModels: AIModel[] = [
  { id: 'M-1', name: 'Demand Forecast', purpose: 'Covers & dish-level demand per branch, 15-min granularity', icon: '📈', accuracy: 93.4, lastTrained: minutesAgo(380), predictionsToday: 12840, status: 'Active', sources: ['POS', 'Reservations', 'Weather', 'Events'] },
  { id: 'M-2', name: 'No-show Prediction', purpose: 'Reservation no-show probability', icon: '🪑', accuracy: 88.1, lastTrained: minutesAgo(1500), predictionsToday: 214, status: 'Active', sources: ['Reservations', 'CRM'] },
  { id: 'M-3', name: 'Customer Churn', purpose: 'Probability a customer lapses within 60 days', icon: '💔', accuracy: 85.7, lastTrained: minutesAgo(2900), predictionsToday: 4820, status: 'Active', sources: ['CRM', 'POS', 'Feedback'] },
  { id: 'M-4', name: 'Delivery ETA', purpose: 'Door-to-door delivery time estimate', icon: '🛵', accuracy: 91.2, lastTrained: minutesAgo(240), predictionsToday: 486, status: 'Active', sources: ['Delivery', 'Kitchen', 'Traffic'] },
  { id: 'M-5', name: 'Spoilage Risk', purpose: 'Ingredient spoilage risk from temps & expiry', icon: '🧊', accuracy: 82.3, lastTrained: minutesAgo(60), predictionsToday: 1320, status: 'Training', sources: ['IoT Sensors', 'Inventory'] },
  { id: 'M-6', name: 'Dynamic Pricing', purpose: 'Channel price & promo recommendations', icon: '🏷️', accuracy: 79.8, lastTrained: minutesAgo(8600), predictionsToday: 96, status: 'Degraded', sources: ['POS', 'Online Menu', 'Competitors'] },
]

const automationRules: AutomationRule[] = [
  { id: 'R-1', name: 'Auto-draft PO on low stock', trigger: 'Inventory level changes', condition: 'Stock < reorder level', action: 'Create purchase request to preferred supplier', module: 'Procurement', enabled: true, runs: 142, lastRun: minutesAgo(35), requiresApproval: true },
  { id: 'R-2', name: 'Confirm high-risk reservations', trigger: 'Reservation created', condition: 'No-show risk > 60%', action: 'Send WhatsApp confirmation request', module: 'Tables', enabled: true, runs: 318, lastRun: minutesAgo(12), requiresApproval: false },
  { id: 'R-3', name: 'Win-back lapsing guests', trigger: 'Nightly churn scoring', condition: 'Churn risk > 70% & spend > $200', action: 'Send 20% off offer via SMS', module: 'Customers', enabled: true, runs: 46, lastRun: minutesAgo(600), requiresApproval: true },
  { id: 'R-4', name: 'Temperature breach escalation', trigger: 'Sensor reading', condition: 'Out of range for > 10 min', action: 'Alert branch manager + log incident', module: 'Compliance', enabled: true, runs: 9, lastRun: minutesAgo(40), requiresApproval: false },
  { id: 'R-5', name: 'Mark 86’d items unavailable online', trigger: 'Item 86’d in kitchen', condition: 'Any branch', action: 'Disable item on all menu channels', module: 'Online Menu', enabled: true, runs: 61, lastRun: minutesAgo(180), requiresApproval: false },
  { id: 'R-6', name: 'Refund anomaly hold', trigger: 'Refund issued', condition: '> 5 refunds / hour by same user', action: 'Freeze refunds & notify finance', module: 'Finance', enabled: true, runs: 2, lastRun: minutesAgo(48), requiresApproval: false },
  { id: 'R-7', name: 'Respond to negative reviews', trigger: 'New review', condition: 'Rating ≤ 2', action: 'Draft AI apology reply for approval', module: 'Social', enabled: false, runs: 0, requiresApproval: true },
  { id: 'R-8', name: 'Rush-hour staffing nudge', trigger: 'Demand forecast updated', condition: 'Forecast > 1.3× scheduled capacity', action: 'Suggest extra shifts to manager', module: 'Employees', enabled: true, runs: 24, lastRun: minutesAgo(1440), requiresApproval: true },
]

const liveEvents: LiveEvent[] = [
  { id: 'E-1', at: minutesAgo(0.3), module: 'Kitchen', message: 'Order #58241 bumped — Karahi station 14 min (target 12)', severity: 'warning' },
  { id: 'E-2', at: minutesAgo(1), module: 'Compliance', message: 'Prep Line Fridge (Mall Road) at 6.8°C — above 5°C for 18 min', severity: 'critical' },
  { id: 'E-3', at: minutesAgo(2), module: 'POS', message: 'Downtown crossed $3,000 in sales today', severity: 'success' },
  { id: 'E-4', at: minutesAgo(4), module: 'Delivery', message: 'Zone C ETA drifting +8 min — rider rebalance suggested', severity: 'warning' },
  { id: 'E-5', at: minutesAgo(6), module: 'Online Menu', message: 'Careem menu sync failed (auth token expired)', severity: 'critical' },
  { id: 'E-6', at: minutesAgo(9), module: 'Tables', message: '3 reservations flagged high no-show risk for 8 PM', severity: 'info' },
  { id: 'E-7', at: minutesAgo(12), module: 'Customers', message: 'Platinum guest Omar Farooq checked in at Mall Road', severity: 'info' },
  { id: 'E-8', at: minutesAgo(15), module: 'Inventory', message: 'Basmati Rice below reorder level at Downtown', severity: 'warning' },
]

export const liveEventTemplates: Omit<LiveEvent, 'id' | 'at'>[] = [
  { module: 'POS', message: 'Table 6 (Downtown) closed — $124.80, 18% tip', severity: 'success' },
  { module: 'Delivery', message: 'Rider Kevin delivered #58252 in 24 min', severity: 'success' },
  { module: 'Kitchen', message: 'Tandoor queue at 9 tickets — above normal', severity: 'warning' },
  { module: 'Social', message: 'Instagram reel crossed 10k views', severity: 'info' },
  { module: 'Finance', message: 'Foodpanda settlement of $6,760 forecast for Thursday', severity: 'info' },
  { module: 'Compliance', message: 'Opening checklist completed at Airport', severity: 'success' },
  { module: 'Customers', message: 'New 1★ review on Google — Airport branch', severity: 'critical' },
  { module: 'Inventory', message: 'Fresh Cream projected to run out by 7:40 PM', severity: 'warning' },
]

const pendingActions: PendingAction[] = [
  { id: 'PA-1', title: 'Create PO: 100 kg Basmati Rice → Metro Foods', detail: 'Stock 6 kg vs reorder level 40 kg. Metro Foods is 4% cheaper than Royal Rice and 96% on-time.', module: 'Procurement', model: 'Demand Forecast', confidence: 94, impact: 'Avoid stock-out Sat dinner', createdAt: minutesAgo(35) },
  { id: 'PA-2', title: 'Send win-back offer to 46 at-risk guests', detail: '20% off, valid 10 days. Expected 18% reactivation (~$1,240 revenue).', module: 'Customers', model: 'Customer Churn', confidence: 86, impact: '+$1,240 est.', createdAt: minutesAgo(120) },
  { id: 'PA-3', title: 'Raise Butter Chicken price on Foodpanda by $0.50', detail: 'Demand is price-inelastic on aggregators; commission eats 17% margin.', module: 'Online Menu', model: 'Dynamic Pricing', confidence: 72, impact: '+$310 / week', createdAt: minutesAgo(260) },
  { id: 'PA-4', title: 'Add 1 line cook Fri 7–10 PM at Downtown', detail: 'Forecast 1.4× normal covers; current roster covers 1.1×.', module: 'Employees', model: 'Demand Forecast', confidence: 89, impact: '-4 min ticket time', createdAt: minutesAgo(400) },
  { id: 'PA-5', title: 'Discard 4 L Fresh Cream (batch DF-1009)', detail: 'Expires in 7 hours and dairy fridge drifted to 4.1°C overnight.', module: 'Compliance', model: 'Spoilage Risk', confidence: 81, impact: 'Food-safety risk avoided', createdAt: minutesAgo(15) },
]

const auditLogs: AuditLog[] = [
  { id: 'AL-1', at: minutesAgo(12), actor: 'AI Engine', action: 'Sent WhatsApp confirmations to 3 high-risk reservations', module: 'Tables', outcome: 'Executed' },
  { id: 'AL-2', at: minutesAgo(40), actor: 'AI Engine', action: 'Escalated temperature breach TS-4 to Omar Sheikh', module: 'Compliance', outcome: 'Executed' },
  { id: 'AL-3', at: minutesAgo(48), actor: 'AI Engine', action: 'Froze refunds for cashier login AIR-C2', module: 'Finance', outcome: 'Executed' },
  { id: 'AL-4', at: minutesAgo(95), actor: 'Sara Ahmed', action: 'Approved PO-7820 suggested by AI (Metro Foods)', module: 'Procurement', outcome: 'Approved' },
  { id: 'AL-5', at: minutesAgo(180), actor: 'AI Engine', action: 'Disabled Prawn Masala on 6 channels (86’d)', module: 'Online Menu', outcome: 'Executed' },
  { id: 'AL-6', at: minutesAgo(310), actor: 'AI Engine', action: 'Careem menu sync', module: 'Online Menu', outcome: 'Failed' },
  { id: 'AL-7', at: minutesAgo(600), actor: 'Ahmed Raza (Owner)', action: 'Rejected 30% flash discount suggestion', module: 'Marketing', outcome: 'Rejected' },
  { id: 'AL-8', at: minutesAgo(900), actor: 'Omar Sheikh', action: 'Approved extra rider shift for Zone C', module: 'Delivery', outcome: 'Approved' },
  { id: 'AL-9', at: minutesAgo(1440), actor: 'AI Engine', action: 'Retrained Demand Forecast model (v3.12)', module: 'AI Engine', outcome: 'Executed' },
  { id: 'AL-10', at: minutesAgo(1600), actor: 'Sara Ahmed', action: 'Approved win-back campaign (38 guests)', module: 'Customers', outcome: 'Approved' },
]

const dataSources: DataSource[] = [
  { module: 'POS & Orders', emoji: '🧾', records: 182400, freshness: 'real-time', status: 'Connected' },
  { module: 'Kitchen (KDS)', emoji: '👨‍🍳', records: 96300, freshness: 'real-time', status: 'Connected' },
  { module: 'Inventory', emoji: '📦', records: 12800, freshness: '1 min', status: 'Connected' },
  { module: 'Procurement', emoji: '🚚', records: 3420, freshness: '5 min', status: 'Connected' },
  { module: 'Tables & Reservations', emoji: '🪑', records: 8810, freshness: 'real-time', status: 'Connected' },
  { module: 'Delivery', emoji: '🛵', records: 41200, freshness: 'real-time', status: 'Connected' },
  { module: 'Employees', emoji: '👥', records: 2140, freshness: '15 min', status: 'Connected' },
  { module: 'Customers & Loyalty', emoji: '💎', records: 24600, freshness: '1 min', status: 'Connected' },
  { module: 'Online Menu', emoji: '📱', records: 940, freshness: '5 min', status: 'Degraded' },
  { module: 'Social Media', emoji: '📣', records: 15300, freshness: '10 min', status: 'Connected' },
  { module: 'Finance', emoji: '💰', records: 58700, freshness: '5 min', status: 'Connected' },
  { module: 'IoT Sensors', emoji: '🌡️', records: 412000, freshness: 'real-time', status: 'Connected' },
]

export const getAIModels = () => request<AIModel[]>('/ai/models', aiModels)
export const retrainModel = (id: string) => mutate(`/ai/models/${id}/retrain`, 'POST', { id })
export const getAutomationRules = () => request<AutomationRule[]>('/ai/automations', automationRules)
export const createAutomationRule = (r: AutomationRule) => mutate('/ai/automations', 'POST', r)
export const updateAutomationRule = (r: AutomationRule) => mutate(`/ai/automations/${r.id}`, 'PATCH', r)
export const getLiveEvents = () => request<LiveEvent[]>('/ai/events', liveEvents)
export const getPendingActions = () => request<PendingAction[]>('/ai/actions/pending', pendingActions)
export const decideAction = (id: string, decision: 'approve' | 'reject') => mutate(`/ai/actions/${id}/${decision}`, 'POST', { id, decision })
export const getAuditLogs = () => request<AuditLog[]>('/ai/audit-logs', auditLogs)
export const getDataSources = () => request<DataSource[]>('/ai/data-sources', dataSources)
