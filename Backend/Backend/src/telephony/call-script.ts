import { orderTotal, type FlowOrder } from '@restaurantos/contracts'
import type { CallScript } from './telephony.types.js'

/** Same currency formatting as the web app (Frontend/src/shared/lib/format.ts). */
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)

/** Voice-agent lines in Roman Urdu, ported from Frontend/src/shared/services/verifyCall.ts. */
export function verificationScript(o: FlowOrder, restaurantName: string): CallScript {
  const items = o.items.map((i) => `${i.qty} ${i.name}`).join(', ')
  return {
    greeting: `Assalam-o-alaikum ${o.customer?.name ?? ''}! Main ${restaurantName} se AI assistant bol raha hoon. Aap ka order: ${items}. Total ${formatCurrency(orderTotal(o))}, ${o.payOnDelivery ?? 'Cash'} on delivery, address: ${o.customer?.address ?? '—'}. Kya main order confirm kar doon?`,
    confirmed: `Shukriya! Aap ka order taqreeban ${o.predictedMins + 15} minute mein pohanch jayega.`,
    declined: 'Theek hai, aap ka order cancel kar diya gaya hai. Allah Hafiz.',
  }
}
