/**
 * ConnectionBadge — small indicator showing network connectivity.
 *
 * Uses react-native-paper Chip for a compact, accessible badge.
 * Displays in the header area of screens.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { useUIStore } from '../store/useUIStore';

export function ConnectionBadge() {
  const { isOnline } = useUIStore();

  return (
    <Chip
      icon={isOnline ? 'wifi' : 'wifi-off'}
      style={[styles.chip, isOnline ? styles.online : styles.offline]}
      textStyle={styles.text}
      compact
    >
      {isOnline ? 'Online' : 'Offline'}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
  },
  online: {
    backgroundColor: '#E8F5E9',
  },
  offline: {
    backgroundColor: '#FFEBEE',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
