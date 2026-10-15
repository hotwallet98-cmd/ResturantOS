import type { FlowItem } from '@restaurantos/contracts';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { money } from '@/store/lib/format';
import { colors, radius, shadow } from '@/store/lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'dark' | 'ghost';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.brand : variant === 'dark' ? colors.ink : 'transparent';
  const fg = variant === 'ghost' ? colors.brand : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: colors.brand },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={small ? 6 : 0}
      style={[
        small ? styles.chipSmall : styles.chip,
        active ? (small ? styles.chipSmallActive : styles.chipActive) : small ? styles.chipSmallIdle : styles.chipIdle,
      ]}>
      <Text
        style={[
          small ? styles.chipSmallText : styles.chipText,
          { color: active ? (small ? colors.brand : '#fff') : colors.muted },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({ qty, onMinus, onPlus, label }: { qty: number; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={styles.stepper}>
      {qty > 0 && (
        <>
          <Pressable accessibilityLabel={`Remove one ${label}`} onPress={onMinus} hitSlop={6} style={[styles.stepBtn, styles.stepMinus]}>
            <Text style={[styles.stepGlyph, { color: colors.ink }]}>−</Text>
          </Pressable>
          <Text style={styles.stepQty}>{qty}</Text>
        </>
      )}
      <Pressable accessibilityLabel={`Add one ${label}`} onPress={onPlus} hitSlop={6} style={[styles.stepBtn, styles.stepPlus]}>
        <Text style={[styles.stepGlyph, { color: '#fff' }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        {...input}
        style={[styles.input, input.multiline && { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 }, error ? { borderColor: colors.red } : null]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function ItemLines({ items }: { items: Pick<FlowItem, 'qty' | 'name' | 'modifiers' | 'notes' | 'price' | 'emoji'>[] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((i, idx) => (
        <View key={idx} style={styles.lineRow}>
          <Text style={styles.lineEmoji}>{i.emoji}</Text>
          <Text style={styles.lineQty}>{i.qty}×</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineName}>{i.name}</Text>
            {i.modifiers.length > 0 && <Text style={styles.lineMeta}>{i.modifiers.join(', ')}</Text>}
            {i.notes ? <Text style={[styles.lineMeta, { color: colors.red }]}>{i.notes}</Text> : null}
          </View>
          <Text style={styles.linePrice}>{money(i.qty * i.price)}</Text>
        </View>
      ))}
    </View>
  );
}

export function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{label}</Text>
      <Text style={strong ? styles.summaryStrong : styles.summaryLabel}>{value}</Text>
    </View>
  );
}

/** Full-area loading / error / empty placeholder. */
export function StateView({
  emoji,
  title,
  message,
  loading,
  action,
}: {
  emoji?: string;
  title: string;
  message?: string;
  loading?: boolean;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator size="large" color={colors.brand} /> : <Text style={{ fontSize: 48 }}>{emoji}</Text>}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMsg}>{message}</Text> : null}
      {action && <Button title={action.title} onPress={action.onPress} style={{ marginTop: 8, alignSelf: 'stretch' }} />}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  button: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: radius.pill, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.ink },
  chipIdle: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipSmall: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  chipSmallActive: { backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brandRing },
  chipSmallIdle: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent' },
  chipSmallText: { fontSize: 12, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepMinus: { backgroundColor: '#f1f2f4' },
  stepPlus: { backgroundColor: colors.brand },
  stepGlyph: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepQty: { minWidth: 18, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.ink },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fafafa',
  },
  fieldHint: { fontSize: 12, color: colors.muted },
  fieldError: { fontSize: 12, color: colors.red, fontWeight: '600' },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineEmoji: { fontSize: 18, width: 24 },
  lineQty: { fontSize: 14, fontWeight: '700', color: colors.ink, minWidth: 24 },
  lineName: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  lineMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  linePrice: { fontSize: 14, color: colors.muted },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: colors.muted },
  summaryStrong: { fontSize: 16, color: colors.ink, fontWeight: '800' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  stateTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  stateMsg: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
