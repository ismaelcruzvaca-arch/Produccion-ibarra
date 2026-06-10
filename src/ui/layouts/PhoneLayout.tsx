/**
 * PhoneLayout — Full-width stacked layout for phone-sized screens.
 *
 * Pattern: Layout Component
 * Why: Provides a full-width single-column layout for devices < 600dp,
 *      matching the spec RL-2.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface PhoneLayoutProps {
  children: React.ReactNode;
}

export function PhoneLayout({ children }: PhoneLayoutProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
