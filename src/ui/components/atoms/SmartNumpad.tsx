/**
 * SmartNumpad — Touch-friendly numerical keyboard with configurable validation.
 *
 * Pattern: Atomic Design — Atom (AD-4)
 * Why:
 * - Current NumpadModal hardcodes OEE_LIMITS.DEFAULT_HARD_LIMIT.
 * - SmartNumpad accepts per-field limits so Quality forms (weight-in-grams, count-of-defects)
 *   reuse the same numpad with different constraints.
 * - If requiresTare, shows two-step: gross weight → tare → net weight.
 * - Touch targets ≥56 dp for industrial tablet with gloves.
 *
 * Props:
 * - min: minimum value (default 0)
 * - max: maximum value (default 99999)
 * - precision: decimal places (0 = integer)
 * - requiresTare: if true, shows gross → tare → net workflow
 * - label: field label for warning messages
 * - unit: optional unit suffix (e.g., 'kg', 'cajas')
 * - onConfirm: (value: number) => void
 * - onWarning: (message: string) => void — called when soft limit is exceeded
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface SmartNumpadProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  onConfirm: (value: number) => void;
  onWarning?: (message: string) => void;
  min?: number;
  max?: number;
  softLimit?: number;
  precision?: number;
  label?: string;
  unit?: string;
  requiresTare?: boolean;
}

type NumpadStep = 'gross' | 'tare' | 'confirm';

export function SmartNumpad({
  visible,
  title,
  onDismiss,
  onConfirm,
  onWarning,
  min = 0,
  max = 99999,
  softLimit,
  precision = 0,
  label,
  unit,
  requiresTare = false,
}: SmartNumpadProps) {
  const [valueStr, setValueStr] = useState('0');
  const [grossStr, setGrossStr] = useState('0');
  const [tareStr, setTareStr] = useState('0');
  const [step, setStep] = useState<NumpadStep>(requiresTare ? 'gross' : 'confirm');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setValueStr('0');
      setGrossStr('0');
      setTareStr('0');
      setStep(requiresTare ? 'gross' : 'confirm');
    }
  }, [visible, requiresTare]);

  const currentValueStr = step === 'confirm' ? valueStr : step === 'gross' ? grossStr : tareStr;
  const setCurrentValueStr = step === 'confirm' ? setValueStr : step === 'gross' ? setGrossStr : setTareStr;

  const numericValue = parseFloat(currentValueStr) || 0;
  const netValue = step === 'confirm' && requiresTare
    ? (parseFloat(grossStr) || 0) - (parseFloat(tareStr) || 0)
    : numericValue;

  const isExceedingMax = numericValue > max;
  const isBelowMin = numericValue < min && currentValueStr !== '0' && currentValueStr !== '';
  const isExceedingSoftLimit = softLimit !== undefined && numericValue > softLimit;
  const isValid = numericValue >= min && numericValue <= max;

  const handleKeyPress = (digit: string) => {
    setCurrentValueStr((prev) => {
      if (prev === '0') {
        return digit;
      }
      if (prev.length >= 10) return prev;
      // Handle decimal point
      if (digit === '.' && prev.includes('.')) return prev;
      if (digit === '.' && precision === 0) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setCurrentValueStr((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setCurrentValueStr('0');
  };

  const handleConfirm = () => {
    if (requiresTare && step === 'gross') {
      setStep('tare');
      return;
    }
    if (requiresTare && step === 'tare') {
      // Calculate net = gross - tare
      const finalValue = Math.max(0, netValue);
      if (softLimit !== undefined && finalValue > softLimit) {
        onWarning?.(`El valor (${finalValue}${unit ? ` ${unit}` : ''}) excede el límite recomendado de ${softLimit}.`);
      }
      onConfirm(finalValue);
      return;
    }
    // Single step
    if (isExceedingSoftLimit) {
      onWarning?.(`El valor (${numericValue}${unit ? ` ${unit}` : ''}) excede el límite recomendado de ${softLimit}.`);
    }
    onConfirm(numericValue);
  };

  const handleDismiss = () => {
    setStep(requiresTare ? 'gross' : 'confirm');
    onDismiss();
  };

  const displayValue = requiresTare && step === 'confirm'
    ? Math.max(0, netValue).toFixed(precision)
    : numericValue.toLocaleString('es-MX', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          {/* Step indicator for tare workflow */}
          {requiresTare && (
            <View style={styles.stepIndicator}>
              <Text style={[styles.stepDot, step === 'gross' && styles.stepActive]}>1</Text>
              <Text style={styles.stepSeparator}>→</Text>
              <Text style={[styles.stepDot, step === 'tare' && styles.stepActive]}>2</Text>
              {step === 'confirm' && (
                <>
                  <Text style={styles.stepSeparator}>→</Text>
                  <Text style={[styles.stepDot, styles.stepActive]}>3</Text>
                </>
              )}
            </View>
          )}

          {/* Step label */}
          {requiresTare && (
            <Text style={styles.stepLabel}>
              {step === 'gross' ? 'Peso Bruto' : step === 'tare' ? 'Peso Tara' : 'Peso Neto'}
            </Text>
          )}

          {/* Display screen */}
          <View
            testID="numpad-display-container"
            style={[
              styles.displayContainer,
              isExceedingMax && styles.displayError,
            ]}
          >
            <Text
              testID="numpad-display-text"
              style={[styles.displayText, isExceedingMax && styles.textError]}
            >
              {displayValue}{unit ?? ''}
            </Text>
          </View>

          {/* Hard Limit Warning */}
          {isExceedingMax && (
            <Text testID="numpad-warning-text" style={styles.warningText}>
              ⚠️ Excede el límite de {max.toLocaleString('es-MX')}
            </Text>
          )}

          {isBelowMin && (
            <Text testID="numpad-min-warning" style={styles.warningText}>
              ⚠️ Debe ser mayor o igual a {min}
            </Text>
          )}

          {isExceedingSoftLimit && (
            <Text style={styles.softWarning}>
              ⚠️ Excede el límite recomendado de {softLimit}
            </Text>
          )}

          {/* Keyboard grid */}
          <View style={styles.gridContainer}>
            <View style={styles.row}>
              {['1', '2', '3'].map((n) => (
                <Button
                  key={n}
                  testID={`numpad-key-${n}`}
                  mode="contained-tonal"
                  onPress={() => handleKeyPress(n)}
                  style={styles.keyButton}
                  contentStyle={styles.keyButtonContent}
                  labelStyle={styles.keyButtonLabel}
                >
                  {n}
                </Button>
              ))}
            </View>
            <View style={styles.row}>
              {['4', '5', '6'].map((n) => (
                <Button
                  key={n}
                  testID={`numpad-key-${n}`}
                  mode="contained-tonal"
                  onPress={() => handleKeyPress(n)}
                  style={styles.keyButton}
                  contentStyle={styles.keyButtonContent}
                  labelStyle={styles.keyButtonLabel}
                >
                  {n}
                </Button>
              ))}
            </View>
            <View style={styles.row}>
              {['7', '8', '9'].map((n) => (
                <Button
                  key={n}
                  testID={`numpad-key-${n}`}
                  mode="contained-tonal"
                  onPress={() => handleKeyPress(n)}
                  style={styles.keyButton}
                  contentStyle={styles.keyButtonContent}
                  labelStyle={styles.keyButtonLabel}
                >
                  {n}
                </Button>
              ))}
            </View>
            <View style={styles.row}>
              <Button
                mode="outlined"
                testID="numpad-key-clear"
                onPress={handleClear}
                style={[styles.keyButton, styles.clearButton]}
                contentStyle={styles.keyButtonContent}
                labelStyle={[styles.keyButtonLabel, styles.clearButtonLabel]}
              >
                C
              </Button>
              <Button
                mode="contained-tonal"
                testID="numpad-key-0"
                onPress={() => handleKeyPress('0')}
                style={styles.keyButton}
                contentStyle={styles.keyButtonContent}
                labelStyle={styles.keyButtonLabel}
              >
                0
              </Button>
              <Button
                mode="outlined"
                testID="numpad-key-backspace"
                onPress={handleBackspace}
                style={styles.keyButton}
                contentStyle={styles.keyButtonContent}
                labelStyle={styles.keyButtonLabel}
                icon="keyboard-backspace"
              >
                {''}
              </Button>
            </View>
            {/* Decimal point */}
            {precision > 0 && (
              <View style={styles.row}>
                <Button
                  mode="outlined"
                  testID="numpad-key-dot"
                  onPress={() => handleKeyPress('.')}
                  style={[styles.keyButton, styles.decimalButton]}
                  contentStyle={styles.keyButtonContent}
                  labelStyle={styles.keyButtonLabel}
                >
                  .
                </Button>
                <View style={{ flex: 2 }} />
              </View>
            )}
          </View>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={handleDismiss}
            mode="text"
            testID="numpad-cancel"
            style={styles.actionButton}
          >
            Cancelar
          </Button>
          <Button
            onPress={handleConfirm}
            disabled={!isValid}
            mode="contained"
            testID="numpad-submit"
            buttonColor={colors.primary}
            style={styles.actionButton}
          >
            {requiresTare && step === 'gross' ? 'Siguiente' :
             requiresTare && step === 'tare' ? 'Calcular Neto' :
             label ? `Registrar ${label}` : 'Registrar'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const touchTargetHeight = 64;

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 450,
    alignSelf: 'center',
    width: '95%',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgGray,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.bold,
    overflow: 'hidden',
  },
  stepActive: {
    backgroundColor: colors.primary,
    color: colors.textOnPrimary,
  },
  stepSeparator: {
    marginHorizontal: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.sizes.bodyMedium,
  },
  stepLabel: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: typography.sizes.bodySmall,
    marginBottom: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  displayContainer: {
    backgroundColor: colors.displayBg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  displayError: {
    backgroundColor: colors.bgRed,
    borderColor: colors.borderError,
  },
  displayText: {
    fontSize: typography.sizes.displayValue,
    fontWeight: typography.weights.bold,
    color: '#212121',
  },
  textError: {
    color: '#C62828',
  },
  warningText: {
    color: '#C62828',
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  softWarning: {
    color: colors.caution,
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  gridContainer: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  keyButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
  },
  keyButtonContent: {
    minHeight: touchTargetHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyButtonLabel: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
  },
  clearButton: {
    borderColor: '#B0BEC5',
  },
  clearButtonLabel: {
    color: '#546E7A',
  },
  decimalButton: {
    flex: 1,
    borderColor: '#B0BEC5',
  },
  actions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  actionButton: {
    minWidth: 100,
    borderRadius: borderRadius.sm,
  },
});


