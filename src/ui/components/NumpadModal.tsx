/**
 * NumpadModal — Touch-friendly numerical keyboard for industrial tablets.
 *
 * Pattern: Reusable Modal Component
 * Why: Prevent "fat-finger" errors on small input boxes by providing large, high-contrast keys (≥60dp).
 * Features:
 * - Implements strict validation matching DEFAULT_HARD_LIMIT (99,999).
 * - Disables registration when limits are exceeded or empty (<=0).
 * - Visual warning in high-visibility red for anomaly protection.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { OEE_LIMITS } from '../../config/oeeLimits';

interface NumpadModalProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  onSubmit: (value: number) => void;
}

export function NumpadModal({ visible, title, onDismiss, onSubmit }: NumpadModalProps) {
  const [valueStr, setValueStr] = useState<string>('0');

  // Reset input when modal becomes visible
  useEffect(() => {
    if (visible) {
      setValueStr('0');
    }
  }, [visible]);

  const handleKeyPress = (digit: string) => {
    setValueStr((prev) => {
      if (prev === '0') {
        return digit;
      }
      // Prevent overflow representation strings from growing endlessly
      if (prev.length >= 10) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setValueStr((prev) => {
      if (prev.length <= 1) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  };

  const handleClear = () => {
    setValueStr('0');
  };

  const numericValue = parseInt(valueStr, 10) || 0;
  const isExceedingHardLimit = numericValue > OEE_LIMITS.DEFAULT_HARD_LIMIT;
  const isValid = numericValue > 0 && !isExceedingHardLimit;

  const handleSubmit = () => {
    if (isValid) {
      onSubmit(numericValue);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          {/* Display screen */}
          <View 
            testID="numpad-display-container"
            style={[styles.displayContainer, isExceedingHardLimit && styles.displayError]}
          >
            <Text 
              testID="numpad-display-text"
              style={[styles.displayText, isExceedingHardLimit && styles.textError]}
            >
              {Number(valueStr).toLocaleString('es-MX')}
            </Text>
          </View>

          {/* Hard Limit Warning */}
          {isExceedingHardLimit && (
            <Text testID="numpad-warning-text" style={styles.warningText}>
              ⚠️ Excede el límite técnico de {OEE_LIMITS.DEFAULT_HARD_LIMIT.toLocaleString('es-MX')} cajas
            </Text>
          )}

          {/* Keyboard Grid */}
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
          </View>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button 
            onPress={onDismiss} 
            mode="text" 
            testID="numpad-cancel"
            style={styles.actionButton}
          >
            Cancelar
          </Button>
          <Button
            onPress={handleSubmit}
            disabled={!isValid}
            mode="contained"
            testID="numpad-submit"
            buttonColor="#5D4037"
            style={styles.actionButton}
          >
            Registrar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 450,
    alignSelf: 'center',
    width: '95%',
  },
  displayContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  displayError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
  },
  displayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
  },
  textError: {
    color: '#C62828',
  },
  warningText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  gridContainer: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  keyButton: {
    flex: 1,
    borderRadius: 8,
  },
  keyButtonContent: {
    minHeight: 64, // Large touch targets
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyButtonLabel: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  clearButton: {
    borderColor: '#B0BEC5',
  },
  clearButtonLabel: {
    color: '#546E7A',
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  actionButton: {
    minWidth: 100,
    borderRadius: 8,
  },
});
