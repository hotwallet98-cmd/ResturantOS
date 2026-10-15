import type { FlowOrder } from '@restaurantos/contracts';

export interface CustomerStatus {
  title: string;
  subtitle: string;
  emoji: string;
  /** Index into TRACK_STEPS; -1 when cancelled. */
  step: number;
}

export function customerStatus(o: Pick<FlowOrder, 'status' | 'call'>): CustomerStatus {
  switch (o.status) {
    case 'Placed':
    case 'Verifying':
      return o.call?.state === 'no_answer'
        ? { title: "We couldn't reach you", subtitle: "We'll try calling again shortly", emoji: '📵', step: 0 }
        : { title: 'Confirming your order', subtitle: 'Please pick up when we call', emoji: '📞', step: 0 };
    case 'Received':
      return { title: 'Order confirmed', subtitle: 'Sent to the kitchen', emoji: '✅', step: 1 };
    case 'Preparing':
      return { title: 'Being prepared', subtitle: 'Our chefs are on it', emoji: '👨‍🍳', step: 2 };
    case 'Ready':
    case 'Packed':
      return { title: 'Ready & packed', subtitle: 'Waiting for the rider to pick up', emoji: '🛍️', step: 3 };
    case 'PickedUp':
      return { title: 'On the way', subtitle: 'Your rider is heading to you', emoji: '🛵', step: 4 };
    case 'Delivered':
    case 'Served':
    case 'Paid':
      return { title: 'Delivered', subtitle: 'Enjoy your meal!', emoji: '🎉', step: 5 };
    case 'Cancelled':
      return { title: 'Order cancelled', subtitle: 'This order will not be delivered', emoji: '🚫', step: -1 };
    default:
      return { title: String(o.status), subtitle: '', emoji: '📦', step: 1 };
  }
}

export const TRACK_STEPS = [
  { label: 'Order placed', emoji: '🧾' },
  { label: 'Confirmed by call', emoji: '📞' },
  { label: 'Preparing', emoji: '👨‍🍳' },
  { label: 'Ready & packed', emoji: '🛍️' },
  { label: 'On the way', emoji: '🛵' },
  { label: 'Delivered', emoji: '🏠' },
] as const;

export const isFinished = (o: Pick<FlowOrder, 'status'>) =>
  o.status === 'Delivered' || o.status === 'Served' || o.status === 'Paid' || o.status === 'Cancelled';
