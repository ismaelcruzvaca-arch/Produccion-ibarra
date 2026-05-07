/**
 * Reports screen — OEE Basic Capture Form.
 *
 * Tablet-optimized form for capturing OEE production metrics:
 * - line_id, total_pieces, rejected_pieces, downtime_minutes
 * - Touch targets ≥48 dp for industrial tablet use
 * - Uses react-native-paper for consistent theming
 * - Validates on submit with HelperText feedback
 * - Success confirmation via Snackbar
 */

import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput, Button, HelperText, Snackbar } from 'react-native-paper';
import { useReportsRepository } from '../../src/repositories/useReportsRepository';
import type { ReportData } from '../../src/core/types';

type FormField = keyof ReportData;

interface FormErrors {
  line_id?: string;
  total_pieces?: string;
  rejected_pieces?: string;
  downtime_minutes?: string;
  general?: string;
}

export default function ReportsScreen() {
  const repository = useReportsRepository();

  const [lineId, setLineId] = useState('');
  const [totalPieces, setTotalPieces] = useState('');
  const [rejectedPieces, setRejectedPieces] = useState('');
  const [downtimeMinutes, setDowntimeMinutes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const validate = useCallback((): boolean => {
    const nextErrors: FormErrors = {};

    if (!lineId.trim()) {
      nextErrors.line_id = 'La línea es obligatoria';
    }

    const total = parseInt(totalPieces, 10);
    if (!totalPieces.trim()) {
      nextErrors.total_pieces = 'El total de piezas es obligatorio';
    } else if (isNaN(total) || total <= 0) {
      nextErrors.total_pieces = 'El total debe ser mayor a 0';
    }

    const rejected = parseInt(rejectedPieces, 10);
    if (!rejectedPieces.trim()) {
      nextErrors.rejected_pieces = 'Los rechazos son obligatorios';
    } else if (isNaN(rejected)) {
      nextErrors.rejected_pieces = 'Ingrese un número válido';
    } else if (!isNaN(total) && rejected > total) {
      nextErrors.rejected_pieces = 'Los rechazos no pueden superar el total';
    }

    const downtime = parseInt(downtimeMinutes, 10);
    if (!downtimeMinutes.trim()) {
      nextErrors.downtime_minutes = 'El tiempo de paro es obligatorio';
    } else if (isNaN(downtime) || downtime < 0) {
      nextErrors.downtime_minutes = 'Ingrese un número válido (≥ 0)';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [lineId, totalPieces, rejectedPieces, downtimeMinutes]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const data: ReportData = {
        line_id: lineId.trim(),
        total_pieces: parseInt(totalPieces, 10),
        rejected_pieces: parseInt(rejectedPieces, 10),
        downtime_minutes: parseInt(downtimeMinutes, 10),
      };

      await repository.createReport(data);

      // Clear form
      setLineId('');
      setTotalPieces('');
      setRejectedPieces('');
      setDowntimeMinutes('');
      setErrors({});
      setSnackbarVisible(true);
    } catch (err) {
      setErrors({ general: 'Error al guardar el reporte. Intente de nuevo.' });
    } finally {
      setSaving(false);
    }
  }, [validate, lineId, totalPieces, rejectedPieces, downtimeMinutes, repository]);

  const hasError = (field: FormField) => !!errors[field];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="headlineMedium" style={styles.title}>
          Captura OEE
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Registre la producción de la línea
        </Text>

        {errors.general && (
          <HelperText type="error" visible style={styles.generalError}>
            {errors.general}
          </HelperText>
        )}

        <TextInput
          label="Línea de producción"
          placeholder="Ej: Línea 1"
          value={lineId}
          onChangeText={setLineId}
          mode="outlined"
          style={styles.input}
          contentStyle={styles.inputContent}
          error={hasError('line_id')}
          disabled={saving}
        />
        <HelperText type="error" visible={hasError('line_id')}>
          {errors.line_id}
        </HelperText>

        <TextInput
          label="Total de piezas"
          placeholder="0"
          value={totalPieces}
          onChangeText={setTotalPieces}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          contentStyle={styles.inputContent}
          error={hasError('total_pieces')}
          disabled={saving}
        />
        <HelperText type="error" visible={hasError('total_pieces')}>
          {errors.total_pieces}
        </HelperText>

        <TextInput
          label="Piezas rechazadas"
          placeholder="0"
          value={rejectedPieces}
          onChangeText={setRejectedPieces}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          contentStyle={styles.inputContent}
          error={hasError('rejected_pieces')}
          disabled={saving}
        />
        <HelperText type="error" visible={hasError('rejected_pieces')}>
          {errors.rejected_pieces}
        </HelperText>

        <TextInput
          label="Tiempo de paro (minutos)"
          placeholder="0"
          value={downtimeMinutes}
          onChangeText={setDowntimeMinutes}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          contentStyle={styles.inputContent}
          error={hasError('downtime_minutes')}
          disabled={saving}
        />
        <HelperText type="error" visible={hasError('downtime_minutes')}>
          {errors.downtime_minutes}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          labelStyle={styles.saveButtonLabel}
        >
          Guardar
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        Reporte guardado correctamente
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
    color: '#757575',
  },
  generalError: {
    marginBottom: 8,
  },
  input: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  inputContent: {
    minHeight: 56,
    fontSize: 18,
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  saveButtonContent: {
    minHeight: 56,
  },
  saveButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
