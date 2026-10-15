import type { FlowOrder } from '@restaurantos/contracts'
import { useEffect, useRef } from 'react'
import { Vibration } from 'react-native'

/**
 * Calls `onNew` for orders that appear in `orders` after the first render (ids seen at mount are ignored),
 * so the user is alerted about new ones only — not the backlog present at login.
 */
export function useNewArrivals(orders: FlowOrder[], ready: boolean, onNew: (o: FlowOrder) => void) {
  const seen = useRef<Set<string> | null>(null)
  const cb = useRef(onNew)
  useEffect(() => {
    cb.current = onNew
  })
  useEffect(() => {
    if (!ready) return
    if (!seen.current) {
      seen.current = new Set(orders.map((o) => o.id))
      return
    }
    for (const o of orders) {
      if (seen.current.has(o.id)) continue
      seen.current.add(o.id)
      cb.current(o)
    }
  }, [orders, ready])
}

export const buzz = () => Vibration.vibrate([0, 350, 150, 350])
