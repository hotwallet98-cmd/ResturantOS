import type { MenuItem, OrderItemInput } from '@restaurantos/contracts';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Unit price shown to the customer: base price plus the variant's add-on (the server recomputes). */
export const unitPrice = (item: MenuItem, variant?: string) =>
  item.price + (item.variants.find((v) => v.name === variant)?.price ?? 0);

export const defaultVariant = (item: MenuItem) => item.variants[0]?.name;

export interface CartLine {
  key: string;
  item: MenuItem;
  variant?: string;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Change qty of item+variant by delta (removes the line at 0). */
  change: (item: MenuItem, variant: string | undefined, delta: number) => void;
  setQty: (key: string, qty: number) => void;
  qtyOfItem: (itemId: string) => number;
  qtyOf: (itemId: string, variant?: string) => number;
  clear: () => void;
  /** Wire format for POST /public/restaurants/:slug/orders — ids, qty and variants only. */
  toOrderItems: () => OrderItemInput[];
}

const CartContext = createContext<CartContextValue | null>(null);

const keyOf = (itemId: string, variant?: string) => `${itemId}|${variant ?? ''}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const change = useCallback((item: MenuItem, variant: string | undefined, delta: number) => {
    const key = keyOf(item.id, variant);
    setLines((cur) => {
      const existing = cur.find((l) => l.key === key);
      if (!existing) return delta > 0 ? [...cur, { key, item, variant, qty: delta }] : cur;
      const qty = Math.max(0, existing.qty + delta);
      return qty === 0 ? cur.filter((l) => l.key !== key) : cur.map((l) => (l.key === key ? { ...l, qty } : l));
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((cur) => (qty <= 0 ? cur.filter((l) => l.key !== key) : cur.map((l) => (l.key === key ? { ...l, qty } : l))));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * unitPrice(l.item, l.variant), 0),
      change,
      setQty,
      qtyOfItem: (itemId) => lines.filter((l) => l.item.id === itemId).reduce((s, l) => s + l.qty, 0),
      qtyOf: (itemId, variant) => lines.find((l) => l.key === keyOf(itemId, variant))?.qty ?? 0,
      clear: () => setLines([]),
      toOrderItems: () =>
        lines.map((l) => ({ itemId: l.item.id, qty: l.qty, modifiers: l.variant ? [l.variant] : [] })),
    }),
    [lines, change, setQty],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
