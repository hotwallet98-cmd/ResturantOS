import { Ionicons } from '@expo/vector-icons'
import { Redirect, router } from 'expo-router'
import { useState, type ComponentProps } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Loading } from '@/components/ui'
import { api, errorMessage } from '@/lib/api'
import { API_URL, DEMO_ACCOUNTS, DEMO_MFA_CODE, DEMO_PASSWORD } from '@/lib/config'
import { resetTo } from '@/lib/nav'
import { colors, radius } from '@/lib/theme'
import { useAuth } from '@/state/auth'

export default function Login() {
  const { user, signIn } = useAuth()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  // Already signed in (e.g. deep link) → the entry route sends them to their role home.
  if (user) return signingIn ? <Loading label="Signing in…" /> : <Redirect href="/" />

  const backToStore = () => (router.canGoBack() ? router.back() : router.replace('/menu'))

  const submitLogin = async (e = email, p = password) => {
    if (!e.trim() || !p) return setError('Enter your email and password.')
    setBusy(true)
    setError(null)
    try {
      const res = await api.auth.login({ email: e.trim().toLowerCase(), password: p })
      setChallengeId(res.challengeId)
      setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (c = code) => {
    if (!challengeId) return
    if (!/^\d{6}$/.test(c)) return setError('Enter the 6-digit code.')
    setBusy(true)
    setError(null)
    try {
      const res = await api.auth.verifyMfa({ challengeId, code: c })
      setSigningIn(true)
      await signIn(res.token, res.user)
      // Fresh history: the role home becomes the root, so Back doesn't return to the store/login.
      resetTo('/')
    } catch (err) {
      setSigningIn(false)
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const pickDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    void submitLogin(demoEmail, DEMO_PASSWORD)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.dark }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <View>
            <Text style={styles.brand}>RestaurantOS</Text>
            <Text style={styles.brandSub}>Staff sign-in · Waiter & Rider</Text>
          </View>
        </View>

        <View style={styles.card}>
          {!challengeId ? (
            <>
              <Text style={styles.h1}>Sign in</Text>
              <Field icon="mail-outline" placeholder="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
              <Field
                icon="lock-closed-outline"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                onSubmitEditing={() => void submitLogin()}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Continue" size="lg" icon="arrow-forward" loading={busy} onPress={() => void submitLogin()} />

              <Text style={styles.demoLabel}>Demo accounts</Text>
              <View style={{ gap: 10 }}>
                {DEMO_ACCOUNTS.map((a) => (
                  <Pressable key={a.email} disabled={busy} onPress={() => pickDemo(a.email)} style={({ pressed }) => [styles.demo, pressed && { backgroundColor: colors.brandSoft }]}>
                    <Ionicons name={a.label === 'Rider' ? 'bicycle' : 'restaurant-outline'} size={22} color={colors.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.demoTitle}>
                        {a.label} · {a.name}
                      </Text>
                      <Text style={styles.demoEmail}>{a.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.h1}>Verify it's you</Text>
              <Text style={styles.body}>Enter the 6-digit code from your authenticator for {email}.</Text>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  const c = t.replace(/\D/g, '').slice(0, 6)
                  setCode(c)
                  if (c.length === 6) void submitCode(c)
                }}
                placeholder="••••••"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                style={styles.code}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Verify & sign in" size="lg" icon="shield-checkmark-outline" loading={busy} onPress={() => void submitCode()} />
              <Button
                title={`Fill demo code (${DEMO_MFA_CODE})`}
                variant="outline"
                disabled={busy}
                onPress={() => {
                  setCode(DEMO_MFA_CODE)
                  void submitCode(DEMO_MFA_CODE)
                }}
              />
              <Button
                title="Use a different account"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setChallengeId(null)
                  setError(null)
                }}
              />
            </>
          )}
        </View>
        <Pressable onPress={backToStore} disabled={busy} style={styles.back} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="storefront-outline" size={18} color="#c4c8d0" />
          <Text style={styles.backText}>Not staff? Back to the store</Text>
        </Pressable>
        <Text style={styles.server}>Server: {API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Field({ icon, ...props }: { icon: ComponentProps<typeof Ionicons>['name'] } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.faint} />
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.faint} style={styles.input} {...props} />
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20, gap: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  brand: { color: '#fff', fontSize: 24, fontWeight: '800' },
  brandSub: { color: '#c4c8d0', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: radius.xl, padding: 20, gap: 14 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
  error: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  demoLabel: { marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, minHeight: 60 },
  demoTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  demoEmail: { fontSize: 13, color: colors.muted },
  code: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 60,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 10,
    color: colors.text,
  },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 },
  backText: { color: '#c4c8d0', fontSize: 15, fontWeight: '600' },
  server: { color: '#8a909c', fontSize: 12, textAlign: 'center' },
})
