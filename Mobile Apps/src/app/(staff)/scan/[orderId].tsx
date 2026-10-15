import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAction } from '@/components/chrome'
import { Button, EmptyState, Loading } from '@/components/ui'
import { buzz } from '@/lib/alerts'
import { api } from '@/lib/api'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'
import { useFlow } from '@/state/flow'

/** The bag QR's text is the order number; tolerate "#1234" / "Order 1234" style payloads too. */
const parseOrderNo = (data: string) => {
  const m = data.match(/\d+/)
  return m ? Number(m[0]) : null
}

export default function ScanPickupScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { user } = useAuth()
  const { flow, loaded, applyOrder } = useFlow()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const { busy, run } = useAction()
  const [manual, setManual] = useState('')
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const locked = useRef(false)

  if (!user || user.role !== 'rider') return <Redirect href="/" />
  const order = flow.orders.find((o) => o.id === orderId)
  if (!order) return loaded ? <EmptyState icon="alert-circle-outline" title="Order not found" body="It may have been reassigned or cancelled." /> : <Loading />

  const canPickUp = order.status === 'Ready' || order.status === 'Packed'

  const confirm = (scannedOrderNo: number) =>
    run(
      'pickup',
      async () => {
        applyOrder(await api.orders.pickup(order.id, { scannedOrderNo }))
        router.back()
      },
      { success: `#${order.orderNo} picked up — counter updated`, alertOnError: true },
    )

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (locked.current || busy) return
    locked.current = true
    const n = parseOrderNo(data)
    if (n === order.orderNo) {
      buzz()
      setScanMsg({ ok: true, text: `Bag matched #${n}` })
      void confirm(n).then((ok) => {
        if (!ok) setTimeout(() => (locked.current = false), 1500)
      })
    } else {
      setScanMsg({ ok: false, text: n ? `This bag is #${n}, not #${order.orderNo}` : 'Not an order QR code' })
      setTimeout(() => (locked.current = false), 2000)
    }
  }

  const manualOk = manual.trim() === String(order.orderNo)

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Scan the QR on the bag for <Text style={{ fontWeight: '800', color: colors.text }}>#{order.orderNo}</Text>
          {order.customer?.name ? ` · ${order.customer.name}` : ''}
        </Text>

        {!canPickUp && (
          <View style={[styles.msg, { backgroundColor: colors.infoSoft }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Text style={[styles.msgText, { color: colors.info }]}>This order is not ready at the counter yet. You can scan once the kitchen marks it Ready.</Text>
          </View>
        )}

        <View style={styles.cameraBox}>
          {Platform.OS === 'web' ? (
            <CameraFallback icon="desktop-outline" text="Camera scanning works in the mobile app. Enter the order number below." />
          ) : !permission ? (
            <Loading label="Checking camera…" />
          ) : !permission.granted ? (
            <View style={{ alignItems: 'center', gap: 12, padding: 20 }}>
              <Ionicons name="camera-outline" size={40} color="#fff" />
              <Text style={styles.camText}>
                {permission.canAskAgain ? 'Allow camera access to scan the bag QR.' : 'Camera access was denied. Enable it in Settings, or enter the order number below.'}
              </Text>
              {permission.canAskAgain ? (
                <Button title="Allow camera" icon="camera" onPress={() => void requestPermission()} />
              ) : (
                <Button title="Open settings" icon="settings-outline" variant="outline" onPress={() => void Linking.openSettings()} />
              )}
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={canPickUp && !busy ? onScanned : undefined}
              />
              <View pointerEvents="none" style={styles.frame} />
            </>
          )}
        </View>

        {scanMsg && (
          <View style={[styles.msg, { backgroundColor: scanMsg.ok ? colors.successSoft : colors.dangerSoft }]}>
            <Ionicons name={scanMsg.ok ? 'checkmark-circle' : 'close-circle'} size={18} color={scanMsg.ok ? colors.success : colors.danger} />
            <Text style={[styles.msgText, { color: scanMsg.ok ? colors.success : colors.danger }]}>{scanMsg.text}</Text>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Or enter the order number</Text>
          <TextInput
            value={manual}
            onChangeText={(t) => setManual(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder={String(order.orderNo)}
            placeholderTextColor={colors.faint}
            style={styles.input}
            maxLength={8}
          />
          {!!manual && !manualOk && <Text style={{ color: colors.danger, fontSize: 13 }}>This bag is not #{order.orderNo}</Text>}
        </View>
        <Button
          title="Confirm pickup"
          icon="checkmark-done"
          size="lg"
          disabled={!manualOk || !canPickUp}
          loading={busy === 'pickup'}
          onPress={() => void confirm(Number(manual))}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function CameraFallback({ icon, text }: { icon: 'desktop-outline'; text: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 20 }}>
      <Ionicons name={icon} size={40} color="#fff" />
      <Text style={styles.camText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, color: colors.muted },
  cameraBox: { aspectRatio: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  frame: { position: 'absolute', top: '18%', left: '18%', right: '18%', bottom: '18%', borderWidth: 3, borderColor: colors.brand, borderRadius: 18 },
  camText: { color: '#e4e7ec', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md },
  msgText: { flex: 1, fontSize: 14, fontWeight: '600' },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: radius.md, minHeight: 56, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 4, color: colors.text },
})
