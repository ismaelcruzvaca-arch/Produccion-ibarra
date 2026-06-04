/**
 * AlertSnackbar — bottom snackbar for new unacknowledged alert events.
 *
 * Appears when the polling detects new events since the last check.
 * Shows a brief message with node name and event details.
 * Auto-dismisses after 5 seconds. Max 3 queued — oldest dismissed if overflow.
 *
 * Pattern: Molecule Component
 * Why:
 * - Encapsulates snackbar queueing, timing, and dismissal logic.
 * - Consumes the unacknowledged count from `useUnacknowledgedCount` to detect deltas.
 * - First poll after mount/login is silent (no storm of historical events).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUnacknowledgedCount } from '../../../hooks/useUnacknowledgedCount';

const MAX_QUEUED_SNACKBARS = 3;
const SNACKBAR_DURATION_MS = 5_000;
const ANIMATION_DURATION_MS = 300;

interface SnackbarItem {
  id: number;
  message: string;
  nodeName: string;
  anim: Animated.Value;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function AlertSnackbar() {
  const { count, lastCheckedAt } = useUnacknowledgedCount();
  const [queue, setQueue] = useState<SnackbarItem[]>([]);
  const previousCountRef = useRef(0);
  const idCounterRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Detect count delta → queue snackbar
  useEffect(() => {
    const prevCount = previousCountRef.current;
    previousCountRef.current = count;

    // First poll or first run: no snackbar
    if (prevCount === 0 && count === 0) return;
    if (prevCount === 0) return; // first real poll, don't show for existing events

    const delta = count - prevCount;
    if (delta <= 0) return;

    // Create snackbar items for new events (max MAX_QUEUED_SNACKBARS)
    const newItems: SnackbarItem[] = [];
    const itemsToShow = Math.min(delta, MAX_QUEUED_SNACKBARS);

    for (let i = 0; i < itemsToShow; i++) {
      const id = ++idCounterRef.current;
      newItems.push({
        id,
        message: count > 0 ? `${count} alerta(s) sin revisar` : 'Nueva alerta',
        nodeName: '',
        anim: new Animated.Value(0),
      });
    }

    setQueue((prev) => {
      // Keep the newest items, drop oldest if over limit
      const combined = [...prev, ...newItems];
      return combined.slice(-MAX_QUEUED_SNACKBARS);
    });

    // Auto-dismiss each new item
    newItems.forEach((item) => {
      // Animate in
      Animated.timing(item.anim, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }).start();

      // Schedule dismiss
      const timer = setTimeout(() => {
        dismissSnackbar(item.id);
      }, SNACKBAR_DURATION_MS);
      timersRef.current.set(item.id, timer);
    });

    // Clean up old timers
    return () => {
      newItems.forEach((item) => {
        const timer = timersRef.current.get(item.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(item.id);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const dismissSnackbar = useCallback((id: number) => {
    const item = queue.find((q) => q.id === id);
    if (!item) return;

    Animated.timing(item.anim, {
      toValue: 0,
      duration: ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      setQueue((prev) => prev.filter((q) => q.id !== id));
    });

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, [queue]);

  if (queue.length === 0) return null;

  return (
    <View style={styles.container}>
      {queue.map((item) => (
        <Animated.View
          key={item.id}
          style={[
            styles.snackbar,
            {
              opacity: item.anim,
              transform: [
                {
                  translateY: item.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons name="bell-ring" size={16} color="#FFFFFF" />
          <View style={styles.textContainer}>
            <Text style={styles.message} numberOfLines={1}>
              {item.nodeName ? `${item.nodeName} — ${item.message}` : item.message}
            </Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // Above tab bar
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 100,
  },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5D4037',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
