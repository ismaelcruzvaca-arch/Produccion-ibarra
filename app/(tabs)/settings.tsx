/**
 * Settings Screen — Application settings dashboard.
 *
 * Pattern: Screen / Route (Atomic Design — Template)
 * Why:
 * - Container that composes settings organisms based on user role permissions.
 * - Uses useSettingsPermissions hook (AD-1) to filter visible sections.
 * - Orders sections: Perfil → Power BI → Catálogos → Sistema
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Text, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useSettingsPermissions } from '../../src/ui/hooks/useSettingsPermissions';
import { SettingsProfile } from '../../src/ui/components/organisms/settings/SettingsProfile';
import { SettingsPowerBI } from '../../src/ui/components/organisms/settings/SettingsPowerBI';
import { SettingsCatalogs } from '../../src/ui/components/organisms/settings/SettingsCatalogs';
import { SettingsConfig } from '../../src/ui/components/organisms/settings/SettingsConfig';
import { SettingsSystem } from '../../src/ui/components/organisms/settings/SettingsSystem';
import { colors, spacing, typography } from '../../src/ui/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const userId = (user as { id?: string } | null)?.id ?? '';
  const { visibleSections, canAccess } = useSettingsPermissions();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut, router]);

  const getRoleSubtitle = (): string => {
    if (canAccess('admin')) return 'Administración del sistema';
    if (canAccess('supervisor')) return 'Supervisión de operaciones';
    return 'Configuración de la aplicación';
  };

  const renderSection = (section: string) => {
    switch (section) {
      case 'profile':
        return <SettingsProfile key={section} onSignOut={handleSignOut} />;
      case 'powerbi':
        return <SettingsPowerBI key={section} />;
      case 'plant_config':
        return <SettingsConfig key={section} />;
      case 'catalogs':
        return <SettingsCatalogs key={section} userId={userId} />;
      case 'system':
        return <SettingsSystem key={section} />;
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Ajustes
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {getRoleSubtitle()}
        </Text>
      </View>

      <Divider style={styles.headerDivider} />

      {/* Sections */}
      <List.Section>
        {visibleSections.map((section) => renderSection(section))}
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  header: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  headerDivider: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
});
