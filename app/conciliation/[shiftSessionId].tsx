/**
 * Conciliation route — supervisor/admin screen for downtime conciliation.
 *
 * Route: /conciliation/{shiftSessionId}
 *
 * Protected: only supervisor/admin roles can access.
 * Back button navigates to dashboard or shifts.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ConciliationScreen } from '../../src/ui/components/organisms/ConciliationScreen';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import { colors, spacing, typography, borderRadius } from '../../src/ui/theme/tokens';

const ALLOWED_ROLES = ['supervisor', 'admin'];

export default function ConciliationRoute() {
  const { shiftSessionId } = useLocalSearchParams<{ shiftSessionId: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const selectedShift = useCatalogStore((s) => s.selectedShift);

  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (role === null) return; // still loading
    setAuthorized(ALLOWED_ROLES.includes(role ?? ''));
  }, [role]);

  // Redirect unauthorized users
  useEffect(() => {
    if (authorized === false) {
      router.replace('/');
    }
  }, [authorized, router]);

  // Show loading while checking auth
  if (authorized === null || authorized === false) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Verificando acceso...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back button header */}
      <View style={styles.header}>
        <Button
          mode="text"
          compact
          icon="arrow-left"
          onPress={() => router.back()}
          style={styles.backButton}
          labelStyle={styles.backButtonLabel}
        >
          Volver
        </Button>
        <Text variant="titleMedium" style={styles.headerTitle}>
          Conciliación de Paros
        </Text>
      </View>

      {/* ConciliationScreen with shift context */}
      <ConciliationScreen
        shiftSessionId={shiftSessionId}
        shiftId={selectedShift ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGray,
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.sizes.bodyMedium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.xs,
  },
  backButtonLabel: {
    fontSize: typography.sizes.bodyMedium,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
});
