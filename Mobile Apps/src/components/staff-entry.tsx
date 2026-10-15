/** Store header button: "Staff login" when signed out, back to the staff role home when signed in. */
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'
import { resetTo } from '@/lib/nav'
import { colors } from '@/lib/theme'
import { useAuth } from '@/state/auth'

export function StaffEntryButton() {
  const { user } = useAuth()
  const label = user ? 'My shift' : 'Staff'
  return (
    <Pressable
      onPress={() => (user ? resetTo('/') : router.push('/login'))}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={user ? 'Back to my staff screens' : 'Staff login'}
      hitSlop={6}
    >
      <Ionicons name={user ? 'briefcase-outline' : 'person-circle-outline'} size={18} color={colors.white} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 36, borderRadius: 10, backgroundColor: colors.dark },
  text: { color: colors.white, fontSize: 12, fontWeight: '700' },
})
