/**
 * ConciliationScreen — Full-screen conciliation UI for supervisors.
 *
 * Pattern: Atomic Design — Organism (Screen)
 * Why:
 * - Displays pending downtime conciliation records grouped by machine.
 * - Four-step workflow: Production Diagnosis → RCA → Verdicts → Corrective Action → Finalize.
 * - Micro-stops (duration < threshold) are excluded from the list.
 *
 * Visibility: Supervisor/Admin only (enforced by parent route).
 *
 * Workflow:
 *   1. List: Shows pending records grouped by machine, with reason, duration, status.
 *   2. Diagnose: Supervisor selects root cause code and adds notes.
 *   3. RCA (optional): 5 Whys or Ishikawa analysis when duration >= threshold.
 *   4. Verdicts: Involved departments sign agree/disagree.
 *   5. Corrective Action (optional): Action plan description.
 *   6. Finalize: Supervisor reviews, finalizes as reconciled, disputed, or escalated.
 */

import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  TextInput,
  Portal,
  Dialog,
  Snackbar,
  ActivityIndicator,
  Divider,
  List,
  IconButton,
  SegmentedButtons,
  Switch,
} from 'react-native-paper';
import { useDowntimeConciliation, type EnrichedOeeEvent, type EnrichedPendingRecord } from '../../hooks/useDowntimeConciliation';
import type { IShiftSummary, ConciliationStatus } from '../../../core/types';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ConciliationScreenProps {
  /** The shift_session UUID (from shift_sessions table) — used for conciliation queries */
  shiftSessionId?: string;
  /** The shift UUID (from oee_events shift_id) — used for loading all OEE events in summary */
  shiftId?: string;
}

// ─── Diagnostic Codes (simplified — would come from catalogs) ──────────────────

const DIAGNOSTIC_CODES = [
  { code: 'FC', label: 'Falla de Cavemil' },
  { code: 'FS', label: 'Falla de Servicios' },
  { code: 'FM', label: 'Falla de molino' },
  { code: 'FT', label: 'Falla de tostador' },
  { code: 'MC', label: 'Mantenimiento correctivo' },
  { code: 'MP', label: 'Mantenimiento preventivo' },
  { code: 'FMP', label: 'Falta materia prima' },
  { code: 'FME', label: 'Falta material empaque' },
  { code: 'AO', label: 'Ajuste de operación' },
  { code: 'OTRO', label: 'Otro' },
];

const MACRO_CODES = [
  { code: 'MTTO', label: 'Mantenimiento' },
  { code: 'PROD', label: 'Producción' },
  { code: 'OTROS', label: 'Otros' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConciliationScreen({ shiftSessionId, shiftId }: ConciliationScreenProps) {
  const {
    pendingRecords,
    groupedByMachine,
    step,
    selectedRecord,
    diagnosedCode,
    conciliatedCode,
    conciliatedMacro,
    notes,
    loading,
    saving,
    error,
    success,
    summaryEvents,
    shiftSummary,
    summaryLoading,
    analysisMethod,
    why_1,
    why_2,
    why_3,
    why_4,
    why_5,
    rootCause,
    verdicts,
    correctiveAction,
    escalationOverdue: isEscalationOverdue,
    escalationCountdown,
    actions,
  } = useDowntimeConciliation();

  // ─── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    actions.loadPendingByShift(shiftSessionId);
  }, [actions, shiftSessionId]);

  // ─── Machine IDs for grouping ───────────────────────────────────────────────
  const machineIds = Object.keys(groupedByMachine);

  // ─── Duration formatting ────────────────────────────────────────────────────
  const formatDuration = (min?: number): string => {
    if (min === undefined || min === null) return '—';
    if (min < 60) return `${Math.round(min)} min`;
    const hours = Math.floor(min / 60);
    const mins = Math.round(min % 60);
    return `${hours}h ${mins}m`;
  };

  // ─── Status chip ────────────────────────────────────────────────────────────
  const renderStatusChip = (status: string) => {
    const colorsMap: Record<string, string> = {
      pending: colors.caution,
      reconciled: colors.success,
      disputed: colors.error,
      escalated: colors.error,
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reconciled: 'Reconciliado',
      disputed: 'Disputado',
      escalated: 'Escalado',
    };
    return (
      <Chip
        mode="flat"
        compact
        textStyle={styles.chipText}
        style={[styles.chip, { backgroundColor: (colorsMap[status] ?? colors.secondary) + '20' }]}
      >
        {labels[status] ?? status}
      </Chip>
    );
  };

  // ─── Lifecycle phase badge ───────────────────────────────────────────────────
  const lifecyclePhaseColors: Record<string, { bg: string; fg: string }> = {
    PLANN: { bg: '#E5E7EB', fg: '#374151' },
    SCHED: { bg: '#DBEAFE', fg: '#1D4ED8' },
    INPRG: { bg: '#FFEDD5', fg: '#C2410C' },
    INREV: { bg: '#FEF9C3', fg: '#A16207' },
    COMP:  { bg: '#DCFCE7', fg: '#15803D' },
    CLOSD: { bg: '#9CA3AF', fg: '#FFFFFF' },
    CNCLD: { bg: '#FEE2E2', fg: '#DC2626' },
  };

  const renderLifecyclePhaseBadge = (phase?: string, subtitle?: string) => {
    if (!phase) return null;
    const colors = lifecyclePhaseColors[phase] ?? { bg: '#F3F4F6', fg: '#6B7280' };
    return (
      <View style={styles.lifecycleBadgeContainer}>
        <View style={[styles.lifecycleBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.lifecycleBadgeText, { color: colors.fg }]}>
            {phase}
          </Text>
        </View>
        {subtitle && (
          <Text style={styles.lifecycleBadgeSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    );
  };

  // ─── Render record item ─────────────────────────────────────────────────────
  const renderRecord = useCallback(
    ({ item }: { item: EnrichedPendingRecord }) => {
      const isDiagnosed = !!item.diagnosed_code;
      return (
        <Card style={styles.recordCard} mode="outlined">
          <Card.Content>
            <View style={styles.recordHeader}>
              <View style={styles.recordInfo}>
                <Text variant="bodyMedium" style={styles.reasonCode}>
                  {item.reason_code}
                </Text>
                <Text variant="bodySmall" style={styles.duration}>
                  {formatDuration(item.duration_min)}
                </Text>
              </View>
              {renderStatusChip(item.status)}
            </View>

            {item.diagnosed_code && (
              <Text variant="bodySmall" style={styles.diagnosedHint}>
                Diagnóstico: {item.diagnosed_code}
              </Text>
            )}

            {/* wo-lifecycle-integration: badge when a cmms-ibero work order exists */}
            {item.wo_cmms_wo_id && renderLifecyclePhaseBadge(item.wo_lifecycle_phase, item.wo_symptom_note)}

            <View style={styles.recordActions}>
              {!isDiagnosed && (
                <Button
                  mode="contained"
                  compact
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                  onPress={() => actions.selectForDiagnosis(item)}
                >
                  Diagnosticar
                </Button>
              )}
              {isDiagnosed && item.status === 'pending' && (
                <Button
                  mode="contained"
                  compact
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                  onPress={() => actions.selectForRca(item)}
                >
                  Analizar RCA
                </Button>
              )}
              {isDiagnosed && item.status === 'pending' && (
                <Button
                  mode="contained"
                  compact
                  style={[styles.actionButton, { marginLeft: spacing.xxs }]}
                  contentStyle={styles.actionButtonContent}
                  onPress={() => actions.selectForFinalization(item)}
                >
                  Finalizar
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
      );
    },
    [actions],
  );

  // ─── Render machine group ───────────────────────────────────────────────────
  const renderMachineGroup = (machineId: string) => {
    const records = groupedByMachine[machineId];
    return (
      <View key={machineId} style={styles.machineGroup}>
        <View style={styles.machineHeader}>
          <List.Icon icon="factory" color={colors.primary} />
          <Text variant="titleSmall" style={styles.machineTitle}>
            {machineId}
          </Text>
          <Chip compact textStyle={styles.countChip}>
            {records.length} pendiente{records.length !== 1 ? 's' : ''}
          </Chip>
        </View>
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    );
  };

  // ─── Diagnose step ──────────────────────────────────────────────────────────
  const renderDiagnoseStep = () => {
    if (!selectedRecord) return null;
    return (
      <ScrollView style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
          <Text variant="titleMedium" style={styles.stepTitle}>
            Diagnóstico de Producción
          </Text>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.infoLabel}>Código original</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.reason_code}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Duración</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{formatDuration(selectedRecord.duration_min)}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Máquina</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.machine_id}</Text>
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Causa raíz (diagnóstico)
        </Text>

        <View style={styles.codeGrid}>
          {DIAGNOSTIC_CODES.map((dc) => (
            <Chip
              key={dc.code}
              mode={diagnosedCode === dc.code ? 'flat' : 'outlined'}
              style={[
                styles.codeChip,
                diagnosedCode === dc.code && { backgroundColor: colors.primary + '20' },
              ]}
              textStyle={[
                styles.codeChipText,
                diagnosedCode === dc.code && { color: colors.primary, fontWeight: typography.weights.bold },
              ]}
              onPress={() => actions.setDiagnosedCode(dc.code)}
            >
              {dc.code} — {dc.label}
            </Chip>
          ))}
        </View>

        <TextInput
          label="Notas"
          value={notes}
          onChangeText={actions.setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.notesInput}
          placeholder="Observaciones del supervisor..."
        />

        <Button
          mode="contained"
          onPress={actions.submitDiagnosis}
          loading={saving}
          disabled={saving || !diagnosedCode}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
        >
          {saving ? 'Guardando...' : 'Guardar Diagnóstico'}
        </Button>
      </ScrollView>
    );
  };

  // ─── RCA step (Wave 5) ─────────────────────────────────────────────────────
  const renderRcaStep = () => {
    if (!selectedRecord) return null;
    return (
      <ScrollView style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
          <Text variant="titleMedium" style={styles.stepTitle}>
            Análisis RCA
          </Text>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.infoLabel}>Código de paro</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.reason_code}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Duración</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{formatDuration(selectedRecord.duration_min)}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Máquina</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.machine_id}</Text>
          </Card.Content>
        </Card>

        {/* Method selector */}
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Método de análisis
        </Text>
        <SegmentedButtons
          value={analysisMethod ?? ''}
          onValueChange={(val) => {
            if (val === '5whys' || val === 'ishikawa' || val === '') {
              actions.setAnalysisMethod(val === '' ? null : val);
            }
          }}
          buttons={[
            { value: '5whys', label: '5 Porqués' },
            { value: 'ishikawa', label: 'Ishikawa' },
            { value: '', label: 'Ninguno' },
          ]}
          style={styles.methodSelector}
        />

        {/* 5 Whys inputs */}
        {analysisMethod === '5whys' && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Cadena de 5 Porqués
            </Text>
            {([1, 2, 3, 4, 5] as const).map((idx) => (
              <TextInput
                key={idx}
                label={`¿Por qué? (${idx}/5)`}
                value={
                  idx === 1 ? why_1 :
                  idx === 2 ? why_2 :
                  idx === 3 ? why_3 :
                  idx === 4 ? why_4 : why_5
                }
                onChangeText={(val) => actions.setWhy(idx, val)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.whyInput}
                placeholder={`Causa ${idx}...`}
              />
            ))}
          </>
        )}

        {/* Ishikawa placeholder */}
        {analysisMethod === 'ishikawa' && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Diagrama Ishikawa
            </Text>
            <Text variant="bodySmall" style={styles.ishikawaHint}>
              Seleccione las categorías aplicables y describa la causa raíz.
            </Text>
            <TextInput
              label="Categorías identificadas"
              value={why_1} // reuse why_1 for ishikawa notes
              onChangeText={(val) => actions.setWhy(1, val)}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.whyInput}
              placeholder="Máquina, Método, Material, Mano de obra, Medición, Medio ambiente..."
            />
          </>
        )}

        {/* Root cause */}
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Causa Raíz
        </Text>
        <TextInput
          label="Resumen de causa raíz"
          value={rootCause}
          onChangeText={actions.setRootCause}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.whyInput}
          placeholder="Describa la causa raíz identificada..."
        />

        <View style={styles.stepNavButtons}>
          <Button
            mode="contained"
            onPress={actions.proceedToVerdicts}
            style={styles.primaryButton}
            contentStyle={styles.primaryButtonContent}
          >
            Siguiente: Firmas
          </Button>
        </View>
      </ScrollView>
    );
  };

  // ─── Verdicts step (Wave 5) ──────────────────────────────────────────────────
  const renderVerdictsStep = () => {
    if (!selectedRecord) return null;
    const involvedDepts = selectedRecord.involved_departments ?? [];

    return (
      <ScrollView style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
          <Text variant="titleMedium" style={styles.stepTitle}>
            Firmas de Departamentos
          </Text>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.infoLabel}>Código de paro</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.reason_code}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Departamentos involucrados</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{involvedDepts.join(', ') || '—'}</Text>
          </Card.Content>
        </Card>

        {involvedDepts.length === 0 ? (
          <View style={styles.centerContent}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No hay departamentos involucrados en este paro.
            </Text>
            <Button
              mode="contained"
              onPress={actions.proceedToCorrectiveAction}
              style={styles.primaryButton}
              contentStyle={styles.primaryButtonContent}
            >
              Siguiente: Acción Correctiva
            </Button>
          </View>
        ) : (
          <>
            {involvedDepts.map((dept) => {
              const existingVerdict = verdicts.find((v) => v.department === dept);
              return (
                <Card key={dept} style={styles.verdictCard} mode="outlined">
                  <Card.Content>
                    <View style={styles.verdictHeader}>
                      <Text variant="bodyMedium" style={styles.verdictDept}>
                        {dept}
                      </Text>
                      <View style={styles.verdictToggle}>
                        <Text variant="bodySmall" style={styles.verdictToggleLabel}>
                          En desacuerdo
                        </Text>
                        <Switch
                          value={existingVerdict?.agreed ?? true}
                          onValueChange={(agreed) => {
                            if (existingVerdict) {
                              actions.updateVerdict(dept, { agreed });
                            } else {
                              actions.addVerdict({
                                department: dept,
                                agreed,
                                signed_by: 'supervisor', // TODO: get actual user
                                signed_at: Date.now(),
                                notes: '',
                              });
                            }
                          }}
                          color={colors.success}
                        />
                        <Text variant="bodySmall" style={styles.verdictToggleLabel}>
                          De acuerdo
                        </Text>
                      </View>
                    </View>

                    <TextInput
                      label="Notas"
                      value={existingVerdict?.notes ?? ''}
                      onChangeText={(val) => {
                        if (existingVerdict) {
                          actions.updateVerdict(dept, { notes: val });
                        } else {
                          actions.addVerdict({
                            department: dept,
                            agreed: true,
                            signed_by: 'supervisor',
                            signed_at: Date.now(),
                            notes: val,
                          });
                        }
                      }}
                      mode="outlined"
                      dense
                      multiline
                      numberOfLines={2}
                      style={styles.notesInput}
                      placeholder="Observaciones..."
                    />
                  </Card.Content>
                </Card>
              );
            })}

            <Button
              mode="contained"
              onPress={actions.proceedToCorrectiveAction}
              style={styles.primaryButton}
              contentStyle={styles.primaryButtonContent}
            >
              Siguiente: Acción Correctiva
            </Button>
          </>
        )}
      </ScrollView>
    );
  };

  // ─── Corrective Action step (Wave 5) ─────────────────────────────────────────
  const renderCorrectiveActionStep = () => {
    if (!selectedRecord) return null;
    const hasCorrectiveAction = correctiveAction !== null;

    return (
      <ScrollView style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
          <Text variant="titleMedium" style={styles.stepTitle}>
            Plan de Acción Correctiva
          </Text>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.infoLabel}>Código de paro</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.reason_code}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Causa raíz</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{rootCause || '—'}</Text>
          </Card.Content>
        </Card>

        {!hasCorrectiveAction ? (
          <View style={styles.optionalSection}>
            <Text variant="bodyMedium" style={styles.optionalText}>
              ¿Desea registrar una acción correctiva para este paro?
            </Text>
            <View style={styles.optionalActions}>
              <Button
                mode="contained"
                onPress={() =>
                  actions.setCorrectiveAction({
                    description: '',
                    responsible: '',
                    department: selectedRecord.involved_departments?.[0] ?? '',
                    due_date: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days default
                    status: 'open',
                  })
                }
                style={styles.primaryButton}
                contentStyle={styles.primaryButtonContent}
              >
                Sí, registrar acción
              </Button>
              <Button
                mode="outlined"
                onPress={actions.submitConciliation}
                loading={saving}
                disabled={saving}
                style={styles.skipButton}
                contentStyle={styles.primaryButtonContent}
              >
                No, finalizar sin acción
              </Button>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              label="Descripción"
              value={correctiveAction.description}
              onChangeText={(val) =>
                actions.setCorrectiveAction({ ...correctiveAction, description: val })
              }
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.whyInput}
              placeholder="Describa la acción a tomar..."
            />

            <TextInput
              label="Responsable"
              value={correctiveAction.responsible}
              onChangeText={(val) =>
                actions.setCorrectiveAction({ ...correctiveAction, responsible: val })
              }
              mode="outlined"
              style={styles.whyInput}
              placeholder="Nombre o rol del responsable"
            />

            <TextInput
              label="Departamento"
              value={correctiveAction.department}
              onChangeText={(val) =>
                actions.setCorrectiveAction({ ...correctiveAction, department: val })
              }
              mode="outlined"
              style={styles.whyInput}
              placeholder="Departamento responsable"
            />

            <TextInput
              label="Fecha de vencimiento"
              value={new Date(correctiveAction.due_date).toLocaleDateString('es-MX')}
              mode="outlined"
              disabled
              style={styles.whyInput}
            />

            <Button
              mode="contained"
              onPress={actions.submitConciliation}
              loading={saving}
              disabled={saving || !correctiveAction.description || !correctiveAction.responsible}
              style={styles.primaryButton}
              contentStyle={styles.primaryButtonContent}
              icon="check-circle"
            >
              {saving ? 'Finalizando...' : 'Finalizar Conciliación'}
            </Button>
          </>
        )}
      </ScrollView>
    );
  };

  // ─── Finalize step ──────────────────────────────────────────────────────────
  const renderFinalizeStep = () => {
    if (!selectedRecord) return null;
    return (
      <ScrollView style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
          <Text variant="titleMedium" style={styles.stepTitle}>
            Finalizar Conciliación
          </Text>
        </View>

        <Card style={styles.infoCard} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.infoLabel}>Código original</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.reason_code}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Diagnóstico de producción</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{selectedRecord.diagnosed_code ?? '—'}</Text>
            <Text variant="bodySmall" style={styles.infoLabel}>Duración</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>{formatDuration(selectedRecord.duration_min)}</Text>
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Código final de causa raíz
        </Text>

        <View style={styles.codeGrid}>
          {DIAGNOSTIC_CODES.map((dc) => (
            <Chip
              key={dc.code}
              mode={conciliatedCode === dc.code ? 'flat' : 'outlined'}
              style={[
                styles.codeChip,
                conciliatedCode === dc.code && { backgroundColor: colors.primary + '20' },
              ]}
              textStyle={[
                styles.codeChipText,
                conciliatedCode === dc.code && { color: colors.primary, fontWeight: typography.weights.bold },
              ]}
              onPress={() => actions.setConciliatedCode(dc.code)}
            >
              {dc.code} — {dc.label}
            </Chip>
          ))}
        </View>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Macro-categoría final
        </Text>

        <View style={styles.macroRow}>
          {MACRO_CODES.map((mc) => (
            <Chip
              key={mc.code}
              mode={conciliatedMacro === mc.code ? 'flat' : 'outlined'}
              style={[
                styles.macroChip,
                conciliatedMacro === mc.code && { backgroundColor: colors.primary + '20' },
              ]}
              textStyle={[
                styles.macroChipText,
                conciliatedMacro === mc.code && { color: colors.primary, fontWeight: typography.weights.bold },
              ]}
              onPress={() => actions.setConciliatedMacro(mc.code)}
            >
              {mc.label}
            </Chip>
          ))}
        </View>

        <TextInput
          label="Notas de conciliación"
          value={notes}
          onChangeText={actions.setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.notesInput}
          placeholder="Acuerdo entre producción y mantenimiento..."
        />

        {/* Escalation banner */}
        {isEscalationOverdue && selectedRecord?.escalation_deadline && (
          <View style={styles.escalationInlineBanner}>
            <List.Icon icon="clock-alert-outline" color={colors.error} />
            <View style={styles.escalationInlineContent}>
              <Text variant="bodySmall" style={styles.escalationInlineText}>
                Esta conciliación superó el plazo de escalación.
              </Text>
              <Button
                mode="text"
                compact
                onPress={actions.escalateConciliation}
                loading={saving}
                disabled={saving}
                textColor={colors.error}
                labelStyle={styles.escalationButtonLabel}
              >
                Escalar a Gerencia
              </Button>
            </View>
          </View>
        )}

        <View style={styles.finalActions}>
          <Button
            mode="contained"
            onPress={actions.reconcile}
            loading={saving}
            disabled={saving || !conciliatedCode || !conciliatedMacro}
            style={styles.reconcileButton}
            contentStyle={styles.primaryButtonContent}
            icon="check-circle"
          >
            {saving ? 'Guardando...' : 'Reconciliar'}
          </Button>

          <Button
            mode="outlined"
            onPress={actions.dispute}
            disabled={saving}
            style={styles.disputeButton}
            contentStyle={styles.primaryButtonContent}
            icon="alert-circle"
            textColor={colors.error}
          >
            Disputar
          </Button>

          <Button
            mode="text"
            onPress={() => {
              if (selectedRecord) actions.selectForRca(selectedRecord);
            }}
            disabled={saving}
            style={styles.rcaNavButton}
            contentStyle={styles.primaryButtonContent}
            icon="magnify-expand"
            textColor={colors.primary}
          >
            Ir a RCA
          </Button>
        </View>
      </ScrollView>
    );
  };

  // ─── Event type label ────────────────────────────────────────────────────────
  const eventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      shift_start: 'Inicio de turno',
      shift_end: 'Cierre de turno',
      downtime_start: 'Inicio de paro',
      downtime_end: 'Fin de paro',
      box_count: 'Conteo de cajas',
      reject_count: 'Conteo de rechazos',
    };
    return labels[type] ?? type;
  };

  // ─── Event icon ──────────────────────────────────────────────────────────────
  const eventTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      shift_start: 'play-circle',
      shift_end: 'stop-circle',
      downtime_start: 'pause-circle',
      downtime_end: 'play-circle-outline',
      box_count: 'package-variant-closed',
      reject_count: 'close-circle',
    };
    return icons[type] ?? 'circle';
  };

  // ─── Status chip (shared) ───────────────────────────────────────────────────
  const statusChip = (status: ConciliationStatus) => {
    const colorsMap: Record<string, string> = {
      pending: colors.caution,
      reconciled: colors.success,
      disputed: colors.error,
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      reconciled: 'Reconciliado',
      disputed: 'Disputado',
    };
    return (
      <Chip
        mode="flat"
        compact
        textStyle={styles.miniChipText}
        style={[styles.miniChip, { backgroundColor: (colorsMap[status] ?? colors.secondary) + '20' }]}
      >
        {labels[status] ?? status}
      </Chip>
    );
  };

  // ─── Format timestamp ────────────────────────────────────────────────────────
  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Summary view (R7) ──────────────────────────────────────────────────────
  const renderSummaryView = () => (
    <View style={styles.container}>
      <View style={styles.stepHeader}>
        <IconButton icon="arrow-left" size={24} onPress={actions.backToList} />
        <Text variant="titleMedium" style={styles.stepTitle}>
          Resumen del Turno
        </Text>
      </View>

      <Divider style={styles.headerDivider} />

      {summaryEvents.length === 0 && !summaryLoading ? (
        <View style={styles.centerContent}>
          <List.Icon icon="clipboard-text-off" color={colors.textSecondary} />
          <Text variant="bodyLarge" style={styles.emptyText}>
            Sin eventos en este turno
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.listContent}>
          {/* Chronological event list */}
          {summaryEvents.map((item, idx) => (
            <Card key={`${item.event.id}-${idx}`} style={styles.recordCard} mode="outlined">
              <Card.Content>
                <View style={styles.summaryEventRow}>
                  <List.Icon icon={eventTypeIcon(item.event.event_type)} color={colors.primary} />
                  <View style={styles.summaryEventInfo}>
                    <Text variant="bodyMedium" style={styles.summaryEventType}>
                      {eventTypeLabel(item.event.event_type)}
                    </Text>
                    <Text variant="bodySmall" style={styles.summaryEventTime}>
                      {formatTime(item.event.timestamp)}
                    </Text>
                    {item.event.reason_code && (
                      <Text variant="bodySmall" style={styles.summaryEventMeta}>
                        Código: {item.event.reason_code}
                      </Text>
                    )}
                    {item.event.quantity !== undefined && item.event.quantity !== null && (
                      <Text variant="bodySmall" style={styles.summaryEventMeta}>
                        Cantidad: {item.event.quantity}
                      </Text>
                    )}
                  </View>
                  {item.conciliation && (
                    <View style={styles.summaryStatusCol}>
                      {statusChip(item.conciliation.status)}
                      {item.conciliation.diagnosed_code && (
                        <Text variant="bodySmall" style={styles.summaryDiagCode}>
                          Dx: {item.conciliation.diagnosed_code}
                        </Text>
                      )}
                      {item.conciliation.conciliated_code && (
                        <Text variant="bodySmall" style={styles.summaryConcilCode}>
                          Rx: {item.conciliation.conciliated_code}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))}

          <Divider style={styles.summaryDivider} />

          {/* Summary metrics */}
          <View style={styles.summaryMetricsCard}>
            <Text variant="titleSmall" style={styles.summaryMetricsTitle}>
              Métricas del Turno
            </Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Planificado</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary ? `${Math.round(shiftSummary.total_planned_min)} min` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Paros totales</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary ? `${Math.round(shiftSummary.total_downtime_min)} min` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Micro-paros</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary ? `${Math.round(shiftSummary.total_micro_stop_min)} min` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>MTTO</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary ? `${Math.round(shiftSummary.total_mtto_min)} min` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>PROD</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary ? `${Math.round(shiftSummary.total_prod_min)} min` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Cajas</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary?.total_boxes ?? '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Rechazos</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary?.total_rejects ?? '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Rendimiento</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {shiftSummary?.performance_pct != null ? `${shiftSummary.performance_pct.toFixed(1)}%` : '—'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Pend. conciliación</Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.metricValue,
                    { color: shiftSummary?.has_pending_conciliation ? colors.caution : colors.success },
                  ]}
                >
                  {shiftSummary?.has_pending_conciliation ? 'Sí' : 'No'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Snackbar feedback */}
      <Snackbar
        visible={!!error || !!success}
        onDismiss={actions.clearMessages}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: actions.clearMessages,
        }}
        style={[
          styles.snackbar,
          { backgroundColor: error ? colors.error : colors.success },
        ]}
      >
        {error || success}
      </Snackbar>
    </View>
  );

  // ─── Main render ────────────────────────────────────────────────────────────

  // Show diagnostic step
  if (step === 'diagnose') {
    return renderDiagnoseStep();
  }

  // Show RCA step (Wave 5)
  if (step === 'rca') {
    return renderRcaStep();
  }

  // Show verdicts step (Wave 5)
  if (step === 'verdicts') {
    return renderVerdictsStep();
  }

  // Show corrective action step (Wave 5)
  if (step === 'corrective_action') {
    return renderCorrectiveActionStep();
  }

  // Show finalize step
  if (step === 'finalize') {
    return renderFinalizeStep();
  }

  // Show summary view
  if (step === 'summary') {
    return renderSummaryView();
  }

  // ─── List step (default) ────────────────────────────────────────────────────
  const hasEscalations = pendingRecords.some((r) => r.status === 'escalated');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Conciliación de Paros
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Revise y reconcilie los paros con causa de mantenimiento
        </Text>
        <Button
          mode="text"
          compact
          icon="clipboard-text-clock-outline"
          onPress={() => {
            if (shiftId) {
              actions.loadShiftSummary(shiftId, shiftSessionId);
            }
          }}
          disabled={!shiftId || summaryLoading}
          loading={summaryLoading}
          style={styles.summaryButton}
          contentStyle={styles.summaryButtonContent}
          labelStyle={styles.summaryButtonLabel}
        >
          Ver resumen del turno
        </Button>
      </View>

      <Divider style={styles.headerDivider} />

      {/* Wave 5: Escalation banner */}
      {isEscalationOverdue && (
        <View style={styles.escalationBanner}>
          <List.Icon icon="alert-decagram" color={colors.error} />
          <View style={styles.escalationBannerContent}>
            <Text variant="bodySmall" style={styles.escalationBannerTitle}>
              Conciliaciones vencidas
            </Text>
            <Text variant="bodySmall" style={styles.escalationBannerText}>
              Hay conciliaciones que han superado el plazo de escalación.
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Cargando registros...
          </Text>
        </View>
      ) : pendingRecords.length === 0 ? (
        <View style={styles.centerContent}>
          <List.Icon icon="check-circle-outline" color={colors.success} />
          <Text variant="bodyLarge" style={styles.emptyText}>
            No hay conciliaciones pendientes
          </Text>
          <Text variant="bodySmall" style={styles.emptyHint}>
            Todos los paros han sido revisados o no hay paros MTTO en este turno.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.listContent}>
          {machineIds.map((mid) => renderMachineGroup(mid))}
        </ScrollView>
      )}

      {/* Snackbar feedback */}
      <Snackbar
        visible={!!error || !!success}
        onDismiss={actions.clearMessages}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: actions.clearMessages,
        }}
        style={[
          styles.snackbar,
          { backgroundColor: error ? colors.error : colors.success },
        ]}
      >
        {error || success}
      </Snackbar>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
  },
  emptyHint: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    padding: spacing.md,
  },
  machineGroup: {
    marginBottom: spacing.md,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  machineTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    flex: 1,
    marginLeft: spacing.xs,
  },
  countChip: {
    height: 24,
    fontSize: 11,
  },
  recordCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reasonCode: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  duration: {
    color: colors.textSecondary,
  },
  diagnosedHint: {
    color: colors.caution,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  // wo-lifecycle-integration: lifecycle phase badge
  lifecycleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap' as const,
  },
  lifecycleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lifecycleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lifecycleBadgeSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  actionButton: {
    borderRadius: borderRadius.sm,
    minHeight: 32,
  },
  actionButtonContent: {
    minHeight: 32,
  },
  separator: {
    height: spacing.xs,
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: 11,
  },
  // Step styles
  stepContainer: {
    flex: 1,
    padding: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  infoLabel: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  codeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  codeChip: {
    marginBottom: spacing.xxs,
    borderColor: colors.secondary,
  },
  codeChipText: {
    fontSize: 12,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  macroChip: {
    borderColor: colors.secondary,
  },
  macroChipText: {
    fontSize: 12,
  },
  notesInput: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  primaryButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  primaryButtonContent: {
    minHeight: 44,
  },
  finalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  reconcileButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
  },
  disputeButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
    borderColor: colors.error,
  },
  snackbar: {
    borderRadius: borderRadius.sm,
  },
  // Summary view styles
  summaryButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  summaryButtonContent: {
    height: 32,
  },
  summaryButtonLabel: {
    fontSize: 13,
  },
  summaryEventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryEventInfo: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  summaryEventType: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  summaryEventTime: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  summaryEventMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  summaryStatusCol: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  summaryDiagCode: {
    fontSize: 10,
    color: colors.caution,
    marginTop: 4,
  },
  summaryConcilCode: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
  },
  miniChip: {
    height: 22,
  },
  miniChipText: {
    fontSize: 10,
  },
  summaryDivider: {
    marginVertical: spacing.md,
  },
  summaryMetricsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryMetricsTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricItem: {
    width: '30%',
    marginBottom: spacing.sm,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  metricValue: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  // ── Wave 5: Escalation banner styles ─────────────────────────────────
  escalationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgRed,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  escalationBannerContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  escalationBannerTitle: {
    color: colors.textError,
    fontWeight: typography.weights.bold,
  },
  escalationBannerText: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  // ── Wave 5: RCA step styles ───────────────────────────────────────────
  methodSelector: {
    marginBottom: spacing.md,
  },
  whyInput: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  ishikawaHint: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  stepNavButtons: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  // ── Wave 5: Verdicts step styles ──────────────────────────────────────
  verdictCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  verdictHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  verdictDept: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  verdictToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  verdictToggleLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  // ── Wave 5: Corrective action step styles ─────────────────────────────
  optionalSection: {
    padding: spacing.md,
    alignItems: 'center',
  },
  optionalText: {
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  optionalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  rcaNavButton: {
    borderRadius: borderRadius.sm,
  },
  // ── Wave 5: Escalation inline banner (in finalize step) ───────────────
  escalationInlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgRed,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  escalationInlineContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  escalationInlineText: {
    color: colors.textError,
    fontWeight: typography.weights.medium,
  },
  escalationButtonLabel: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
});
