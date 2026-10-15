import { Ionicons } from '@expo/vector-icons'
import type { MenuItem, OrderItemInput } from '@restaurantos/contracts'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAction } from '@/components/chrome'
import { Button, Chip, ChipRow, EmptyState, Loading } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

/** Cart keyed by `${itemId}|${variant}` (same as the web MenuPicker). */
type Cart = Record<string, { itemId: string; variant?: string; qty: number }>

const unitPrice = (m: MenuItem, variant?: string) => m.price + (m.variants.find((v) => v.name === variant)?.price ?? 0)

export default function TakeOrderScreen() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>()
  const { user } = useAuth()
  const { flow, applyOrder } = useFlow()
  const insets = useSafeAreaInsets()
  const { busy, run } = useAction()

  const [menu, setMenu] = useState<MenuItem[] | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [cart, setCart] = useState<Cart>({})
  const [note, setNote] = useState('')

  const loadMenu = useCallback(async () => {
    setMenuError(null)
    try {
      setMenu(await api.menu())
    } catch (e) {
      setMenuError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void loadMenu()
  }, [loadMenu])

  const categories = useMemo(() => ['All', ...Array.from(new Set((menu ?? []).map((m) => m.category)))], [menu])
  const list = useMemo(
    () => (menu ?? []).filter((m) => m.available && (cat === 'All' || m.category === cat) && (!q || m.name.toLowerCase().includes(q.trim().toLowerCase()))),
    [menu, cat, q],
  )

  if (!user || user.role !== 'waiter') return <Redirect href="/" />
  const table = flow.tables.find((t) => t.id === tableId)
  const title = `New order · Table ${table?.name ?? tableId}`

  const selectedVariant = (m: MenuItem) => variants[m.id] ?? m.variants[0]?.name
  const keyOf = (m: MenuItem) => `${m.id}|${selectedVariant(m) ?? ''}`
  const change = (m: MenuItem, d: number) => {
    const k = keyOf(m)
    setCart((c) => {
      const qty = Math.max(0, (c[k]?.qty ?? 0) + d)
      const next = { ...c }
      if (qty === 0) delete next[k]
      else next[k] = { itemId: m.id, variant: selectedVariant(m), qty }
      return next
    })
  }

  const lines = Object.values(cart).filter((c) => c.qty > 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const total = lines.reduce((s, l) => {
    const m = menu?.find((x) => x.id === l.itemId)
    return s + (m ? unitPrice(m, l.variant) * l.qty : 0)
  }, 0)

  const send = () => {
    // Kitchen note goes on the first line, like the web prototype.
    const items: OrderItemInput[] = lines.map((l, i) => ({
      itemId: l.itemId,
      qty: l.qty,
      ...(l.variant ? { modifiers: [l.variant] } : {}),
      ...(i === 0 && note.trim() ? { notes: note.trim() } : {}),
    }))
    void run(
      'send',
      async () => {
        const order = await api.orders.createForTable({ tableId, items })
        applyOrder(order)
        router.back()
        router.navigate('/waiter/orders')
        return order
      },
      { success: (o) => (o?.orderNo ? `#${o.orderNo} sent — counter logged it and kitchen has it` : 'Order sent to the kitchen') },
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title }} />
      {!menu ? (
        menuError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Could not load the menu"
            body={menuError}
            action={<Button title="Try again" icon="refresh" onPress={() => void loadMenu()} style={{ marginTop: 8, alignSelf: 'stretch' }} />}
          />
        ) : (
          <Loading label="Loading menu…" />
        )
      ) : (
        <>
          <View style={{ gap: 10, paddingTop: 12 }}>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.faint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search menu…" placeholderTextColor={colors.faint} style={styles.searchInput} autoCorrect={false} clearButtonMode="while-editing" />
            </View>
            <ChipRow>
              {categories.map((c) => (
                <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
              ))}
            </ChipRow>
          </View>
          <FlatList
            data={list}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
            ListEmptyComponent={<EmptyState icon="fast-food-outline" title="No dishes found" body={q ? `Nothing matches “${q}”.` : 'Nothing available in this category.'} />}
            renderItem={({ item: m }) => {
              const inCart = Object.values(cart).filter((c) => c.itemId === m.id)
              const qtyTotal = inCart.reduce((s, c) => s + c.qty, 0)
              const k = keyOf(m)
              const qtySel = cart[k]?.qty ?? 0
              return (
                <View style={[styles.item, qtyTotal > 0 && { borderColor: '#fdba8c' }]}>
                  <View style={styles.emoji}>
                    <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {m.name}
                      {m.veg ? <Text style={{ color: colors.success }}> ●</Text> : null}
                    </Text>
                    <Text style={styles.itemPrice}>{formatCurrency(unitPrice(m, selectedVariant(m)))}</Text>
                    {m.variants.length > 0 && (
                      <View style={styles.variants}>
                        {m.variants.map((v) => {
                          const on = selectedVariant(m) === v.name
                          const n = cart[`${m.id}|${v.name}`]?.qty
                          return (
                            <Pressable key={v.name} onPress={() => setVariants((s) => ({ ...s, [m.id]: v.name }))} style={[styles.variant, on && styles.variantOn]} hitSlop={4}>
                              <Text style={[styles.variantText, on && { color: colors.brand }]}>
                                {v.name}
                                {n ? ` ×${n}` : ''}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    )}
                  </View>
                  <View style={styles.stepper}>
                    {qtySel > 0 && (
                      <>
                        <Pressable onPress={() => change(m, -1)} style={styles.stepBtn} accessibilityLabel={`Remove ${m.name}`}>
                          <Ionicons name="remove" size={20} color={colors.text} />
                        </Pressable>
                        <Text style={styles.qty}>{qtySel}</Text>
                      </>
                    )}
                    <Pressable onPress={() => change(m, 1)} style={[styles.stepBtn, { backgroundColor: colors.brand }]} accessibilityLabel={`Add ${m.name}`}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )
            }}
          />
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput value={note} onChangeText={setNote} placeholder="Kitchen note (e.g. less spicy)" placeholderTextColor={colors.faint} style={styles.note} />
            <Button
              title={count ? `Send to kitchen · ${count} item${count > 1 ? 's' : ''} · ${formatCurrency(total)}` : 'Add dishes to send'}
              icon="send"
              size="lg"
              disabled={!count}
              loading={busy === 'send'}
              onPress={send}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  item: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' },
  emoji: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemPrice: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variant: { paddingHorizontal: 10, minHeight: 32, justifyContent: 'center', borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.bg },
  variantOn: { backgroundColor: colors.brandSoft, borderColor: '#fdba8c' },
  variantText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 10 },
  note: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 46, paddingHorizontal: 12, fontSize: 15, color: colors.text },
})
