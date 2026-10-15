import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/lib/theme'

type Tone = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const insets = useSafeAreaInsets()

  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      clearTimeout(timer.current)
      setToast({ id: Date.now(), message, tone })
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
      timer.current = setTimeout(
        () => Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null)),
        tone === 'error' ? 4500 : 3000,
      )
    },
    [opacity],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const bg = toast?.tone === 'error' ? colors.danger : toast?.tone === 'info' ? colors.dark : colors.success
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8, opacity }]}>
          <Pressable onPress={() => setToast(null)} style={[styles.toast, { backgroundColor: bg }]} accessibilityRole="alert">
            <Text style={styles.text}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 20 },
  toast: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
