/**
 * ActiveShiftBanner — Prominent hero card for the currently active shift.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Shows at the top of the shift list when there's an active shift.
 * - Displays elapsed time via DurationTimer, operator, planned boxes.
 * - Uses amber/warning color scheme for visibility.
 *
 * Props:
 * - session: IShiftSession — the active shift session
 * - onGoToOEE: () => void — called when user taps "Ver en OEE"
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import { DurationTimer } from './DurationTimer';
import type { IShiftSession } from '../../../core/types';

interface ActiveShiftBannerProps {
  session: IShiftSession;
  onGoToOEE: () => void;
  testID?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActiveShiftBanner({
  session,
  onGoToOEE,
  testID,
}: ActiveShiftBannerProps) {
  return (
    <Card
      style={styles.card}
      testID={testID}
    >
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.activeDot} />
          <Text style={styles.title}>Turno Activo</Text>
        </View>

        <View style={styles.timerContainer}>
          <DurationTimer
            startTime={session.started_at}
            isActive={true}
            color={colors.textOnPrimary}
          />
        </View>

        <Text style={styles.startedAt}>
          Iniciado: {formatTime(session.started_at)}
        </Text>

        <View style={styles.divider} />

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Operador</Text>
            <Text style={styles.detailValue}>{session.operator_id}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cajas Planeadas</Text>
            <Text style={styles.detailValue}>
              {session.planned_boxes?.toLocaleString('es-MX') ?? '—'}
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={onGoToOEE}
          style={styles.ctaButton}
          labelStyle={styles.ctaLabel}
          contentStyle={styles.ctaContent}
          buttonColor={colors.white}
          textColor={colors.caution}
        >
          Ir a pantalla OEE
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.caution,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.online,
    marginRight: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  startedAt: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textOnPrimary,
    textAlign: 'center',
    opacity: 0.9,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: spacing.sm,
  },
  details: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textOnPrimary,
    opacity: 0.85,
  },
  detailValue: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textOnPrimary,
  },
  ctaButton: {
    borderRadius: borderRadius.sm,
  },
  ctaLabel: {
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.button,
  },
  ctaContent: {
    minHeight: 48,
  },
});
