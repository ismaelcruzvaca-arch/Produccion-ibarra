/**
 * DurationTimer — Formatted elapsed time display with internal interval.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Extracts the timer logic from OeeDashboard into a reusable component.
 * - Uses 1-second interval internally.
 * - Formats as HH:MM:SS.
 *
 * Usage:
 *   <DurationTimer startTime={activeDowntimeEvent.get('timestamp')} />
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, typography } from '../../theme/tokens';

interface DurationTimerProps {
  /** Epoch ms timestamp when the timer started */
  startTime: number;
  /** Whether the timer is active (pauses when false) */
  isActive?: boolean;
  /** Color override for the text */
  color?: string;
  testID?: string;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function DurationTimer({
  startTime,
  isActive = true,
  color = colors.textSecondary,
  testID,
}: DurationTimerProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setDuration(0);
      return;
    }
    const update = () => {
      setDuration(Date.now() - startTime);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[styles.timer, { color }]} testID={testID ? `${testID}-text` : undefined}>
        {formatDuration(duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  timer: {
    fontSize: typography.sizes.displayValue,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
});
