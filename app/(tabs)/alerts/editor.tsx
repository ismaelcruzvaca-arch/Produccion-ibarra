/**
 * Alert Rule Editor — Create and edit alert rules.
 *
 * Cascading pickers:
 * 1. Machine selector (grouped from NodeCatalog)
 * 2. Node selector (filtered by selected machine)
 * 3. Condition type selector (filtered by selected node's capabilities)
 * 4. Threshold input (numeric)
 * 5. Channels multi-select (EMAIL, SNACKBAR, SMS)
 * 6. Cooldown minutes
 *
 * Edit mode: pre-fill from rule passed via route params.
 * Create mode: empty form, machine picker loads first.
 *
 * Pattern: Screen / Template (Atomic Design)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Chip, Checkbox, Dialog, Portal } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchNodeCatalog, upsertRule } from '../../../src/services/alertEngine';
import type { NodeCatalog, AlertRule, AlertRuleUpsertInput } from '../../../src/types/alertEngine';
import { colors, spacing, typography } from '../../../src/ui/theme/tokens';

// ─── Available channels ─────────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'EMAIL', label: 'Email', icon: 'email' as const },
  { key: 'SNACKBAR', label: 'Notificación push', icon: 'bell-ring' as const },
  { key: 'SMS', label: 'SMS', icon: 'message-text' as const },
];

// ─── Picker Modal ───────────────────────────────────────────────────────────────

interface PickerOption {
  label: string;
  value: string;
  metadata?: string;
}

function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onDismiss: () => void;
}) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.pickerDialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <ScrollView style={styles.pickerList}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pickerItem,
                  selected === opt.value && styles.pickerItemSelected,
                ]}
                onPress={() => {
                  onSelect(opt.value);
                  onDismiss();
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    selected === opt.value && styles.pickerItemTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.metadata && (
                  <Text style={styles.pickerItemMeta}>{opt.metadata}</Text>
                )}
              </TouchableOpacity>
            ))}
            {options.length === 0 && (
              <Text style={styles.pickerEmpty}>Sin opciones disponibles</Text>
            )}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancelar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ─── Editor Screen ──────────────────────────────────────────────────────────────

export default function AlertRuleEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rule?: string }>();

  // Parsed rule for edit mode
  const editRule: AlertRule | null = useMemo(() => {
    if (!params.rule) return null;
    try {
      return JSON.parse(params.rule) as AlertRule;
    } catch {
      return null;
    }
  }, [params.rule]);

  const isEditing = editRule !== null;

  // ── State ──────────────────────────────────────────────────────────────

  const [nodeCatalog, setNodeCatalog] = useState<NodeCatalog[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form fields
  const [selectedMachine, setSelectedMachine] = useState<string | null>(
    isEditing ? editRule!.node_id : null,
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(
    isEditing ? editRule!.node_id : null,
  );
  const [selectedCondition, setSelectedCondition] = useState<string | null>(
    isEditing ? editRule!.tipo_condicion : null,
  );
  const [threshold, setThreshold] = useState(
    isEditing ? String(editRule!.valor_umbral) : '',
  );
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    isEditing ? editRule!.canales : [],
  );
  const [cooldown, setCooldown] = useState(
    isEditing ? String(editRule!.cooldown_minutos) : '',
  );

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Picker visibility
  const [machinePickerVisible, setMachinePickerVisible] = useState(false);
  const [nodePickerVisible, setNodePickerVisible] = useState(false);
  const [conditionPickerVisible, setConditionPickerVisible] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);

  // Unsaved changes tracking
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // ── Derived data ───────────────────────────────────────────────────────

  const machines = useMemo(() => {
    const seen = new Set<string>();
    return nodeCatalog
      .filter((n) => {
        if (seen.has(n.machine.name)) return false;
        seen.add(n.machine.name);
        return true;
      })
      .map((n) => ({
        label: n.machine.name,
        value: n.machine.name,
        metadata: n.machine.line.name,
      }));
  }, [nodeCatalog]);

  const nodesForMachine = useMemo(() => {
    if (!selectedMachine) return [];
    return nodeCatalog
      .filter((n) => n.machine.name === selectedMachine)
      .map((n) => ({
        label: n.node_ident,
        value: n.id,
        metadata: n.device_model.model_name,
      }));
  }, [nodeCatalog, selectedMachine]);

  const conditionsForNode = useMemo(() => {
    const node = nodeCatalog.find((n) => n.id === selectedNode);
    if (!node) return [];
    return node.device_model.model_capabilities.map((cap) => ({
      label: cap.alert_capability.description,
      value: cap.alert_capability.capability_key,
    }));
  }, [nodeCatalog, selectedNode]);

  // ── Load catalog ───────────────────────────────────────────────────────

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const nodes = await fetchNodeCatalog();
      setNodeCatalog(nodes);
    } catch (err: any) {
      setCatalogError('No se pudo cargar el catálogo de equipos');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errors: string[] = [];

    if (!selectedNode) errors.push('Selecciona un nodo');
    if (!selectedCondition) errors.push('Selecciona un tipo de condición');
    if (!threshold || Number(threshold) <= 0) {
      errors.push('El umbral debe ser mayor a 0');
    }
    if (selectedChannels.length === 0) {
      errors.push('Selecciona al menos un canal de notificación');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [selectedNode, selectedCondition, threshold, selectedChannels]);

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const input: AlertRuleUpsertInput = {
        node_id: selectedNode!,
        tipo_condicion: selectedCondition!,
        valor_umbral: Number(threshold),
        canales: selectedChannels,
        cooldown_minutos: Number(cooldown) || 30,
        enabled: true,
      };

      await upsertRule(input, isEditing ? editRule!.id : undefined);
      router.back();
    } catch (err: any) {
      Alert.alert(
        'Error al guardar',
        'No se pudo guardar la regla. Intenta de nuevo.',
        [{ text: 'OK' }],
      );
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    selectedNode,
    selectedCondition,
    threshold,
    selectedChannels,
    cooldown,
    isEditing,
    editRule,
    router,
  ]);

  // ── Unsaved changes tracking ───────────────────────────────────────────

  useEffect(() => {
    setHasUnsaved(
      selectedNode !== (isEditing ? editRule!.node_id : null) ||
      selectedCondition !== (isEditing ? editRule!.tipo_condicion : null) ||
      threshold !== (isEditing ? String(editRule!.valor_umbral) : '') ||
      JSON.stringify(selectedChannels) !== JSON.stringify(isEditing ? editRule!.canales : []) ||
      cooldown !== (isEditing ? String(editRule!.cooldown_minutos) : ''),
    );
  }, [selectedNode, selectedCondition, threshold, selectedChannels, cooldown, isEditing, editRule]);

  // ── Back with unsaved changes check ────────────────────────────────────

  useEffect(() => {
    // expo-router's back navigation — we intercept via the header
    // by checking before navigating
  }, []);

  const handleBack = useCallback(() => {
    if (hasUnsaved) {
      Alert.alert(
        '¿Descartar cambios?',
        'Tienes cambios sin guardar.',
        [
          { text: 'Continuar editando', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      router.back();
    }
  }, [hasUnsaved, router]);

  // ── Toggle channel ─────────────────────────────────────────────────────

  const toggleChannel = useCallback((channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel],
    );
  }, []);

  // ── Picker helpers ─────────────────────────────────────────────────────

  const selectedMachineLabel = selectedMachine
    ? machines.find((m) => m.value === selectedMachine)?.label
    : null;

  const selectedNodeLabel = selectedNode
    ? nodesForMachine.find((n) => n.value === selectedNode)?.label
    : null;

  const selectedConditionLabel = selectedCondition
    ? conditionsForNode.find((c) => c.value === selectedCondition)?.label
    : null;

  // ── Loading state ──────────────────────────────────────────────────────

  if (catalogLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando catálogo de equipos...</Text>
      </View>
    );
  }

  // ── Catalog error state ────────────────────────────────────────────────

  if (catalogError) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="cloud-alert" size={48} color="#D32F2F" />
        <Text style={styles.errorText}>{catalogError}</Text>
        <Button
          mode="outlined"
          onPress={loadCatalog}
          style={{ marginTop: spacing.md }}
          textColor={colors.primary}
        >
          Reintentar
        </Button>
      </View>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Editar regla' : 'Nueva regla'}
          </Text>
        </View>

        {/* ── Machine Picker ───────────────────────────────────────── */}
        <Text style={styles.label}>Máquina</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setMachinePickerVisible(true)}
        >
          <Text style={selectedMachineLabel ? styles.pickerValue : styles.pickerPlaceholder}>
            {selectedMachineLabel ?? 'Seleccionar máquina'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Node Picker ──────────────────────────────────────────── */}
        <Text style={styles.label}>Nodo / Sensor</Text>
        <TouchableOpacity
          style={[styles.pickerButton, !selectedMachine && styles.pickerDisabled]}
          onPress={() => selectedMachine && setNodePickerVisible(true)}
        >
          <Text style={selectedNodeLabel ? styles.pickerValue : styles.pickerPlaceholder}>
            {selectedNodeLabel ?? (selectedMachine ? 'Seleccionar nodo' : 'Primero selecciona una máquina')}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Condition Type Picker ────────────────────────────────── */}
        <Text style={styles.label}>Tipo de condición</Text>
        <TouchableOpacity
          style={[styles.pickerButton, !selectedNode && styles.pickerDisabled]}
          onPress={() => selectedNode && setConditionPickerVisible(true)}
        >
          <Text style={selectedConditionLabel ? styles.pickerValue : styles.pickerPlaceholder}>
            {selectedConditionLabel ?? (selectedNode ? 'Seleccionar condición' : 'Primero selecciona un nodo')}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Threshold ────────────────────────────────────────────── */}
        <Text style={styles.label}>Umbral</Text>
        <TextInput
          style={styles.textInput}
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          placeholder="Ej: 30"
          placeholderTextColor={colors.textSecondary}
        />

        {/* ── Channels ────────────────────────────────────────────── */}
        <Text style={styles.label}>Canales de notificación</Text>
        <View style={styles.channelsContainer}>
          {CHANNELS.map((ch) => (
            <TouchableOpacity
              key={ch.key}
              style={[
                styles.channelItem,
                selectedChannels.includes(ch.key) && styles.channelItemSelected,
              ]}
              onPress={() => toggleChannel(ch.key)}
            >
              <Checkbox
                status={selectedChannels.includes(ch.key) ? 'checked' : 'unchecked'}
                color={colors.primary}
              />
              <MaterialCommunityIcons
                name={ch.icon}
                size={18}
                color={selectedChannels.includes(ch.key) ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.channelLabel,
                  selectedChannels.includes(ch.key) && styles.channelLabelSelected,
                ]}
              >
                {ch.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Cooldown ────────────────────────────────────────────── */}
        <Text style={styles.label}>Cooldown (minutos)</Text>
        <TextInput
          style={styles.textInput}
          value={cooldown}
          onChangeText={setCooldown}
          keyboardType="numeric"
          placeholder="Ej: 30"
          placeholderTextColor={colors.textSecondary}
        />

        {/* ── Validation Errors ───────────────────────────────────── */}
        {validationErrors.length > 0 && (
          <View style={styles.validationContainer}>
            {validationErrors.map((err, i) => (
              <View key={i} style={styles.validationRow}>
                <MaterialCommunityIcons name="alert-circle" size={14} color={colors.error} />
                <Text style={styles.validationText}>{err}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Save Button ─────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          buttonColor={colors.primary}
          contentStyle={styles.saveButtonContent}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </ScrollView>

      {/* ── Pickers ───────────────────────────────────────────────── */}
      <PickerModal
        visible={machinePickerVisible}
        title="Seleccionar máquina"
        options={machines}
        selected={selectedMachine}
        onSelect={(v) => {
          setSelectedMachine(v);
          setSelectedNode(null);
          setSelectedCondition(null);
        }}
        onDismiss={() => setMachinePickerVisible(false)}
      />

      <PickerModal
        visible={nodePickerVisible}
        title="Seleccionar nodo"
        options={nodesForMachine}
        selected={selectedNode}
        onSelect={(v) => {
          setSelectedNode(v);
          setSelectedCondition(null);
        }}
        onDismiss={() => setNodePickerVisible(false)}
      />

      <PickerModal
        visible={conditionPickerVisible}
        title="Seleccionar condición"
        options={conditionsForNode}
        selected={selectedCondition}
        onSelect={setSelectedCondition}
        onDismiss={() => setConditionPickerVisible(false)}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgGray,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: typography.sizes.titleLarge,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xxs,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  pickerValue: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
  },
  pickerPlaceholder: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
  },
  channelsContainer: {
    gap: spacing.xs,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  channelItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFEBE9',
  },
  channelLabel: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
  },
  channelLabelSelected: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  validationContainer: {
    marginTop: spacing.md,
    gap: spacing.xxs,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  validationText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.error,
  },
  saveButton: {
    marginTop: spacing.lg,
    borderRadius: 8,
  },
  saveButtonContent: {
    paddingVertical: 6,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.bodyMedium,
    color: colors.textError,
    textAlign: 'center',
  },
  // ── Picker modal ──────────────────────────────────────────────────
  pickerDialog: {
    maxHeight: '60%',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: '#EFEBE9',
  },
  pickerItemText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
  },
  pickerItemTextSelected: {
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  pickerItemMeta: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pickerEmpty: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
