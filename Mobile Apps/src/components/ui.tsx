import { Ionicons } from '@expo/vector-icons'
import type { FlowOrder, FlowStatus } from '@restaurantos/contracts'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatCurrency, statusMeta } from '@/lib/format'
import { colors, radius, TOUCH } from '@/lib/theme'
import { useFlow } from '@/state/flow'

export type IconName = ComponentProps<typeof Ionicons>['name']

type Variant = 'primary' | 'success' | 'outline' | 'dark' | 'ghost' | 'danger'

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
  style,
}: {
  title: string
  onPress?: () => void
  icon?: IconName
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: StyleProp<ViewStyle>
}) {
  const v = buttonVariants[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, minHeight: size === 'lg' ? 56 : size === 'sm' ? 42 : TOUCH },
        pressed && { opacity: 0.85 },
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={size === 'lg' ? 22 : 18} color={v.fg} /> : null}
      <Text style={[styles.btnText, { color: v.fg, fontSize: size === 'lg' ? 17 : size === 'sm' ? 14 : 15 }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  )
}

const buttonVariants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
  success: { bg: colors.success, fg: colors.white, border: colors.success },
  dark: { bg: colors.dark, fg: colors.white, border: colors.dark },
  outline: { bg: colors.white, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
  danger: { bg: colors.white, fg: colors.danger, border: '#fecdca' },
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active ? { backgroundColor: colors.dark, borderColor: colors.dark } : null]}
    >
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }} style={{ flexGrow: 0 }}>
      {children}
    </ScrollView>
  )
}

export function Card({ children, style, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; highlight?: string }) {
  return <View style={[styles.card, highlight ? { borderColor: highlight, borderWidth: 2 } : null, style]}>{children}</View>
}

export function StatusBadge({ status }: { status: FlowStatus }) {
  const m = statusMeta[status]
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: m.fg }]} />
      <Text style={[styles.badgeText, { color: m.fg }]}>{m.label}</Text>
    </View>
  )
}

export function Pill({ text, bg = colors.bg, fg = colors.muted }: { text: string; bg?: string; fg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  )
}

export function ItemLines({ order, showPrices }: { order: Pick<FlowOrder, 'items'>; showPrices?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      {order.items.map((i, idx) => (
        <View key={idx} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={[styles.lineText, { fontWeight: '700' }]}>{i.qty}×</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineText}>
              {i.emoji ? `${i.emoji} ` : ''}
              {i.name}
              {i.modifiers.length > 0 && <Text style={{ color: colors.muted }}> · {i.modifiers.join(', ')}</Text>}
            </Text>
            {!!i.notes && <Text style={{ color: colors.danger, fontSize: 13 }}>{i.notes}</Text>}
          </View>
          {showPrices && <Text style={[styles.lineText, { color: colors.muted }]}>{formatCurrency(i.qty * i.price)}</Text>}
        </View>
      ))}
    </View>
  )
}

/** Order-level note (customer / waiter → kitchen). Renders nothing when the order has none. */
export function OrderNote({ order }: { order: Pick<FlowOrder, 'notes'> }) {
  const note = order.notes?.trim()
  if (!note) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 8, padding: 8 }}>
      <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.danger} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.danger, fontSize: 13 }}>{note}</Text>
    </View>
  )
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel="Decrease" onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} style={[styles.stepBtn, value <= min && { opacity: 0.4 }]}>
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable accessibilityLabel="Increase" onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} style={[styles.stepBtn, { backgroundColor: colors.brand }, value >= max && { opacity: 0.4 }]}>
        <Ionicons name="add" size={22} color={colors.white} />
      </Pressable>
    </View>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!body && <Text style={styles.emptyBody}>{body}</Text>}
      {action}
    </View>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.emptyBody}>{label}</Text>
    </View>
  )
}

/** Bottom sheet built on RN Modal. */
export function Sheet({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {!!subtitle && <Text style={styles.sheetSubtitle}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>
}

export const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  btnText: { fontWeight: '700' },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  lineText: { fontSize: 14, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetSubtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
})

/**
 * Pull-to-refresh that re-fetches GET /flow. Forwards all props because ScrollView clones
 * its refreshControl (on Android it wraps the list as children).
 */
export function PullToRefresh(props: Partial<RefreshControlProps>) {
  const { refresh } = useFlow()
  const [refreshing, setRefreshing] = useState(false)
  return (
    <RefreshControl
      {...props}
      refreshing={refreshing}
      tintColor={colors.brand}
      colors={[colors.brand]}
      onRefresh={async () => {
        setRefreshing(true)
        await refresh()
        setRefreshing(false)
      }}
    />
  )
}
