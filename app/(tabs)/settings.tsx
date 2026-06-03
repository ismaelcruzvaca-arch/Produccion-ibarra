/**
 * Settings Screen — admin panel with profile, PowerBI, catalogs, and system info.
 *
 * Composes 4 organism sections inside a ScrollView:
 * - SettingsProfile   → user profile card with role badge, line, sync, logout
 * - SettingsPowerBI   → PowerBI deep link (admin/supervisor only)
 * - SettingsCatalogs  → catalog CRUD (admin) or read-only (others)
 * - SettingsSystem    → app version, Nhost status, last sync
 *
 * Tab routing is handled by ../_layout.tsx — no changes needed there.
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SettingsProfile } from '../../src/ui/components/organisms/settings/SettingsProfile';
import { SettingsPowerBI } from '../../src/ui/components/organisms/settings/SettingsPowerBI';
import { SettingsCatalogs } from '../../src/ui/components/organisms/settings/SettingsCatalogs';
import { SettingsSystem } from '../../src/ui/components/organisms/settings/SettingsSystem';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SettingsProfile />
      <SettingsPowerBI />
      <SettingsCatalogs />
      <SettingsSystem />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
});
