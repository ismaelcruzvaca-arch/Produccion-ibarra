/**
 * TabletLayout — Max-width 840dp centred wrapper for tablet-sized screens.
 *
 * Pattern: Layout Component
 * Why: Keeps content from stretching too wide on large tablets. Centres the
 *      content area with a max-width of 840dp, matching the spec RL-1.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TabletLayoutProps {
  children: React.ReactNode;
}

export function TabletLayout({ children }: TabletLayoutProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 840,
  },
});
