/**
 * AlertBadge — small overlay badge for the Alerts tab icon.
 *
 * Shows unacknowledged event count in a red circular badge.
 * Hidden when count is 0.
 *
 * Pattern: Atom Component
 * Why:
 * - Reusable across the tab layout and any future icon-based badge needs.
 * - Pure presentational — no state, no side effects.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AlertBadgeProps {
  /** Count to display. 0 = hidden. >99 shows "99+". */
  count: number;
}

export function AlertBadge({ count }: AlertBadgeProps) {
  if (count === 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 14,
  },
});
