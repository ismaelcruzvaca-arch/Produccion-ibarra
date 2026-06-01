/**
 * Quality Trends Screen — Weight line chart, defect severity bar chart, live quality KPI.
 *
 * Architecture: Thin Container (Hook + Presentational)
 * All state orchestration delegated to useQualityTrends().
 * Charts rendered via react-native-chart-kit.
 * Empty states per section when no data is available.
 * Power BI deep-link button conditionally rendered via EXPO_PUBLIC_POWERBI_URL.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Linking } from 'react-native';
import { Text, Button, Card, Title, useTheme } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';

import { useQualityTrends } from '../../../src/ui/hooks/useQualityTrends';
import { useCatalogStore } from '../../../src/ui/store/catalogStore';
import { StateWrapper } from '../../../src/ui/components/atoms/StateWrapper';
import { QUALITY_EMPTY_INDICATOR, QUALITY_LIMITS } from '../../../src/config/qualityLimits';
import { colors, spacing, typography, borderRadius } from '../../../src/ui/theme/tokens';
import type { ShiftType } from '../../../src/core/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HORIZONTAL_PADDING = spacing.md * 2;
const CHART_WIDTH = SCREEN_WIDTH - CHART_HORIZONTAL_PADDING;
const CHART_HEIGHT = 220;

const POWERBI_URL = process.env.EXPO_PUBLIC_POWERBI_URL;
const isPowerBiConfigured = Boolean(POWERBI_URL && POWERBI_URL.length > 0);

export default function QualityTrendsScreen() {
  // ─── Resolve machine & shift context from catalog store ───────────────────
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);
  const selectedShift = useCatalogStore((s) => s.selectedShift);
  const getShiftById = useCatalogStore((s) => s.getShiftById);
  const shift = selectedShift ? getShiftById(selectedShift) : undefined;
  const shiftType = (shift?.label?.toLowerCase() ?? 'matutino') as ShiftType;

  const machineId = selectedMachine ?? '';

  // ─── Hook ─────────────────────────────────────────────────────────────────
  const {
    weightTrend,
    defectsBySeverity,
    liveQuality,
    loading,
    empty,
  } = useQualityTrends(machineId, shiftType);

  // ─── Power BI handler ─────────────────────────────────────────────────────
  const handleOpenPowerBI = async () => {
    if (!POWERBI_URL) return;
    try {
      const supported = await Linking.canOpenURL(POWERBI_URL);
      if (supported) {
        await Linking.openURL(POWERBI_URL);
      }
    } catch {
      // Silently fail — non-critical feature
      console.warn('Failed to open Power BI URL');
    }
  };

  // ─── State ────────────────────────────────────────────────────────────────
  const state = loading ? 'loading' : 'success';

  return (
    <StateWrapper state={state}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        testID="quality-trends-screen"
      >
        {/* ════════════════════════════════════════════════════════════════════
           Section 1: Weight Trend Line Chart
           ════════════════════════════════════════════════════════════════════ */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Tendencia de Pesos</Title>

            {empty.weight ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>Sin datos de peso</Text>
              </View>
            ) : (
              <>
                <LineChart
                  data={{
                    labels: weightTrend.labels,
                    datasets: [
                      {
                        data: weightTrend.datasets[0].data,
                        color: () => colors.primary,
                        strokeWidth: 2,
                      },
                      // Upper limit reference line
                      ...(weightTrend.referenceLines.max > 0
                        ? [
                            {
                              data: Array(weightTrend.datasets[0].data.length).fill(
                                weightTrend.referenceLines.max,
                              ),
                              color: () => colors.error,
                              strokeWidth: 1,
                              withDots: false,
                            },
                          ]
                        : []),
                      // Lower limit reference line
                      ...(weightTrend.referenceLines.min > 0
                        ? [
                            {
                              data: Array(weightTrend.datasets[0].data.length).fill(
                                weightTrend.referenceLines.min,
                              ),
                              color: () => colors.error,
                              strokeWidth: 1,
                              withDots: false,
                            },
                          ]
                        : []),
                    ],
                  }}
                  width={CHART_WIDTH}
                  height={CHART_HEIGHT}
                  yAxisSuffix="g"
                  chartConfig={{
                    backgroundColor: colors.white,
                    backgroundGradientFrom: colors.white,
                    backgroundGradientTo: colors.white,
                    decimalPlaces: 0,
                    color: () => colors.textSecondary,
                    labelColor: () => colors.textSecondary,
                    propsForDots: {
                      r: '4',
                      strokeWidth: '1.5',
                      stroke: colors.primary,
                    },
                  }}
                  bezier
                  style={styles.chart}
                />

                {/* Reference line legend */}
                {weightTrend.referenceLines.max > 0 && (
                  <View style={styles.referenceLegend}>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendLine, { backgroundColor: colors.error }]} />
                      <Text style={styles.legendText}>
                        Límite sup: {weightTrend.referenceLines.max}g
                      </Text>
                    </View>
                    <View style={styles.legendRow}>
                      <View style={[styles.legendLine, { backgroundColor: colors.error }]} />
                      <Text style={styles.legendText}>
                        Límite inf: {weightTrend.referenceLines.min}g
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
           Section 2: Defect Severity Bar Chart
           ════════════════════════════════════════════════════════════════════ */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Defectos por Severidad</Title>

            {empty.defects ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>Sin defectos registrados</Text>
              </View>
            ) : (
              <BarChart
                data={{
                  labels: ['Crítico', 'Mayor', 'Menor'],
                  datasets: [
                    {
                      data: [
                        defectsBySeverity.critical,
                        defectsBySeverity.major,
                        defectsBySeverity.minor,
                      ],
                    },
                  ],
                }}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: colors.white,
                  backgroundGradientFrom: colors.white,
                  backgroundGradientTo: colors.white,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(93, 64, 55, ${opacity})`,
                  labelColor: () => colors.textSecondary,
                  barPercentage: 0.6,
                }}
                style={styles.chart}
              />
            )}
          </Card.Content>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
           Section 3: Live Quality % KPI
           ════════════════════════════════════════════════════════════════════ */}
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Calidad en Vivo</Title>

            {empty.inspections ? (
              <View style={styles.emptySection}>
                <Text style={styles.kpiEmpty}>{QUALITY_EMPTY_INDICATOR}</Text>
                <Text style={styles.emptyText}>Sin inspecciones en este turno</Text>
              </View>
            ) : (
              <>
                <View style={styles.kpiContainer}>
                  <Text
                    style={[
                      styles.kpiValue,
                      { color: liveQuality.qualityPct >= 80 ? colors.success : colors.error },
                    ]}
                    testID="quality-kpi-value"
                  >
                    {Math.round(liveQuality.qualityPct)}%
                  </Text>
                  <Text style={styles.kpiLabel}>Tasa de Liberación</Text>
                </View>

                <View style={styles.kpiDetail}>
                  <View style={styles.kpiDetailItem}>
                    <Text style={styles.kpiDetailLabel}>Liberado</Text>
                    <Text style={[styles.kpiDetailValue, { color: colors.success }]}>
                      {liveQuality.passed}
                    </Text>
                  </View>
                  <View style={styles.kpiDetailItem}>
                    <Text style={styles.kpiDetailLabel}>Rechazado</Text>
                    <Text style={[styles.kpiDetailValue, { color: colors.error }]}>
                      {liveQuality.failed}
                    </Text>
                  </View>
                  <View style={styles.kpiDetailItem}>
                    <Text style={styles.kpiDetailLabel}>Reproceso</Text>
                    <Text style={[styles.kpiDetailValue, { color: colors.caution }]}>
                      {liveQuality.rework}
                    </Text>
                  </View>
                  <View style={styles.kpiDetailItem}>
                    <Text style={styles.kpiDetailLabel}>Total</Text>
                    <Text style={styles.kpiDetailValue}>{liveQuality.total}</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
           Section 4: Power BI Deep-Link Button
           ════════════════════════════════════════════════════════════════════ */}
        {isPowerBiConfigured && (
          <Card style={styles.card}>
            <Card.Content>
              <Button
                mode="contained"
                icon="chart-box"
                style={styles.powerBiButton}
                contentStyle={styles.buttonContent}
                onPress={handleOpenPowerBI}
              >
                Ver en Power BI
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </StateWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chart: {
    borderRadius: borderRadius.sm,
  },
  emptySection: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Reference line legend
  referenceLegend: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  legendLine: {
    width: 16,
    height: 2,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
  },

  // KPI
  kpiContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  kpiValue: {
    fontSize: typography.sizes.displayValue,
    fontWeight: typography.weights.bold,
  },
  kpiLabel: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  kpiEmpty: {
    fontSize: typography.sizes.displayValue,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  kpiDetail: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  kpiDetailItem: {
    alignItems: 'center',
  },
  kpiDetailLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  kpiDetailValue: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },

  // Power BI
  powerBiButton: {
    borderRadius: borderRadius.sm,
  },
  buttonContent: {
    minHeight: 48,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
