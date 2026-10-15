import { mock, USE_MOCKS, http } from './client'

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type CopilotScope = 'admin' | 'restaurant'

const restaurantAnswers: [RegExp, string][] = [
  [/sale|revenue/i, "Today's sales are $8,420 across 214 orders — 12% above the same weekday last month. Dine-in leads at 54%, delivery is 31%. Mall Road is the top branch."],
  [/stock|inventory|ingredient/i, '3 ingredients are below reorder level: Basmati Rice (6 kg), Chicken Thigh (9 kg), Fresh Cream (4 L). I can draft purchase orders to Metro Foods and Dairy Fresh — want me to?'],
  [/staff|shift|schedule/i, 'Friday dinner is forecast at 1.4× normal covers. I recommend adding 2 servers and 1 line cook between 7–10 PM at Downtown.'],
  [/menu|dish|price/i, 'Chicken Karahi has the best margin-to-popularity ratio. Paneer Tikka is a "puzzle" item (high margin, low sales) — try featuring it on the online menu and in the next social post.'],
  [/table|reserv/i, 'Tonight there are 38 reservations; 3 have a high no-show risk. I suggest sending a confirmation SMS and holding 2 tables for walk-ins.'],
  [/delivery|rider/i, 'Average delivery ETA today is 31 min. Zone C is running 8 min slow — reassigning one rider from Zone A should balance it.'],
]

const adminAnswers: [RegExp, string][] = [
  [/revenue|mrr|subscription/i, 'Platform MRR is $184.2K (+6.8% MoM). 12 trials convert this week; 4 accounts show churn risk — mainly low POS usage in the last 14 days.'],
  [/tenant|restaurant|onboard/i, '1,284 restaurants are active, 37 pending verification. 5 onboarding applications have missing documents — I can send reminder emails.'],
  [/alert|incident|error|health/i, 'All core services are operational. The WhatsApp gateway shows 2.1% elevated failures since 09:40; the Foodpanda integration has 3 tenants with sync errors.'],
  [/security|login|suspicious/i, '2 suspicious login patterns detected in the last 24h (impossible travel). Both accounts were challenged with MFA and are now locked pending review.'],
]

function answer(prompt: string, scope: CopilotScope) {
  const table = scope === 'admin' ? adminAnswers : restaurantAnswers
  const hit = table.find(([re]) => re.test(prompt))
  return (
    hit?.[1] ??
    (scope === 'admin'
      ? 'I can help with tenants, subscriptions, platform health and security. Try "Which restaurants are at churn risk?"'
      : 'I can help with sales, inventory, staffing, menu, reservations and delivery. Try "What should I reorder today?"')
  )
}

/** AI Restaurant Management Copilot (Central AI & Automation Engine). */
export async function askCopilot(prompt: string, scope: CopilotScope): Promise<CopilotMessage> {
  if (!USE_MOCKS) return http<CopilotMessage>('/ai/copilot', { method: 'POST', body: JSON.stringify({ prompt, scope }) })
  return mock({ id: crypto.randomUUID(), role: 'assistant', text: answer(prompt, scope) }, 700)
}

export const copilotSuggestions: Record<CopilotScope, string[]> = {
  restaurant: ["How are today's sales?", 'What should I reorder?', 'Staffing for Friday?', 'Any no-show risks tonight?'],
  admin: ['Platform revenue this month?', 'Tenants at churn risk?', 'Any active incidents?', 'Suspicious logins?'],
}
