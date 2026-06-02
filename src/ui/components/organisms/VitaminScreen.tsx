/**
 * VitaminScreen organism — Vitamin Kit form (F-PD-06).
 *
 * Spec compliance:
 * - VF-1: SHALL support up to 3 products per turno
 * - VF-2: SHALL record #Orden, #Kit, semi-terminado, ingredients with lotes
 * - VF-3: SHALL verify microingredient kits by Production AND Quality
 * - VF-4: SHALL record peso báscula vs peso físico
 * - VF-5: SHALL require Operador, Jefe Turno, Verif. Producción, Verif. Calidad signatures
 * - S1: Operator fills batches → Verif. Prod checks → Verif. Calidad verifies → Jefe Turno authorizes.
 *
 * Signature chain: operator → supervisor → verif_produccion → verif_calidad
 * - document_type: 'vitamin_kit'
 * - Uses useSignatures hook for chain orchestration
 * - Uses SignaturePrompt for the tap-to-confirm dialog
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Divider,
  Switch,
  ActivityIndicator,
} from 'react-native-paper';

import { useVitaminRepository } from '../../../repositories/useVitaminRepository';
import { useSignatures, DEFAULT_CHAINS } from '../../../hooks/useSignatures';
import { useAuthStore } from '../../../auth/useAuthStore';
import { useCatalogStore } from '../../store/catalogStore';
import { SignaturePrompt } from '../molecules/SignaturePrompt';

// ─── Constants ──────────────────────────────────────────────────────────────────

const CHAIN_CONFIG = DEFAULT_CHAINS.vitamin_kit;

const MAX_PRODUCTS = 3;

interface IngredientEntry {
  name: string;
  lote: string;
  quantity_kg: string;
}

interface ProductEntry {
  orden: string;
  kit: string;
  semi_terminado: string;
  ingredients: IngredientEntry[];
}

function createEmptyProduct(): ProductEntry {
  return { orden: '', kit: '', semi_terminado: '', ingredients: [] };
}

function createEmptyIngredient(): IngredientEntry {
  return { name: '', lote: '', quantity_kg: '' };
}

// ─── Numeric input helper ───────────────────────────────────────────────────────

function parseNumeric(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function VitaminScreen() {
  const repository = useVitaminRepository();
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const { operatorId, fullName, role: currentRole } = useAuthStore();

  // ─── Form state: Products (VF-1) ──────────────────────────────────────────

  const [products, setProducts] = useState<ProductEntry[]>([createEmptyProduct()]);

  // ─── Verifications (VF-3) ──────────────────────────────────────────────────

  const [verifProduccion, setVerifProduccion] = useState(false);
  const [verifCalidad, setVerifCalidad] = useState(false);

  // ─── Weight (VF-4) ─────────────────────────────────────────────────────────

  const [pesoBascula, setPesoBascula] = useState('');
  const [pesoFisico, setPesoFisico] = useState('');

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const docIdRef = useRef<string | null>(null);

  // Signature hook
  const {
    status: sigStatus,
    isLoading: sigLoading,
    error: sigError,
    sign: doSign,
    refresh: refreshSigs,
  } = useSignatures({
    documentType: 'vitamin_kit',
    documentId: savedDocId ?? '',
    chainConfig: CHAIN_CONFIG,
  });

  // ─── Product helpers ───────────────────────────────────────────────────────

  const updateProduct = useCallback(
    (index: number, field: keyof ProductEntry, value: string) => {
      setProducts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addProduct = useCallback(() => {
    setProducts((prev) => {
      if (prev.length >= MAX_PRODUCTS) return prev;
      return [...prev, createEmptyProduct()];
    });
  }, []);

  const removeProduct = useCallback((index: number) => {
    setProducts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // ─── Ingredient helpers ────────────────────────────────────────────────────

  const addIngredient = useCallback((productIndex: number) => {
    setProducts((prev) => {
      const next = [...prev];
      next[productIndex] = {
        ...next[productIndex],
        ingredients: [...next[productIndex].ingredients, createEmptyIngredient()],
      };
      return next;
    });
  }, []);

  const updateIngredient = useCallback(
    (productIndex: number, ingredientIndex: number, field: keyof IngredientEntry, value: string) => {
      setProducts((prev) => {
        const next = [...prev];
        const ingredients = [...next[productIndex].ingredients];
        ingredients[ingredientIndex] = { ...ingredients[ingredientIndex], [field]: value };
        next[productIndex] = { ...next[productIndex], ingredients };
        return next;
      });
    },
    []
  );

  const removeIngredient = useCallback(
    (productIndex: number, ingredientIndex: number) => {
      setProducts((prev) => {
        const next = [...prev];
        next[productIndex] = {
          ...next[productIndex],
          ingredients: next[productIndex].ingredients.filter((_, i) => i !== ingredientIndex),
        };
        return next;
      });
    },
    []
  );

  // ─── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) {
      throw new Error('Faltan datos de contexto (línea, máquina, turno u operador)');
    }

    // Build ingredients array from all products
    const allIngredients: Array<{ name: string; lote: string; quantity_kg: number }> = [];
    products.forEach((p) => {
      p.ingredients.forEach((ing) => {
        allIngredients.push({
          name: ing.name,
          lote: ing.lote,
          quantity_kg: parseNumeric(ing.quantity_kg),
        });
      });
    });

    return {
      line_id: selectedLine,
      machine_id: selectedMachine,
      shift_id: selectedShift,
      operator_id: operatorId,
      orden: products[0]?.orden ?? '',
      kit: products[0]?.kit ?? '',
      semi_terminado: products[0]?.semi_terminado ?? '',
      ingredients: allIngredients,
      verif_produccion: verifProduccion,
      verif_calidad: verifCalidad,
      peso_bascula_kg: parseNumeric(pesoBascula),
      peso_fisico_kg: parseNumeric(pesoFisico),
    };
  }, [
    selectedLine, selectedMachine, selectedShift, operatorId,
    products, verifProduccion, verifCalidad, pesoBascula, pesoFisico,
  ]);

  // ─── Create document + start signature chain ───────────────────────────────

  const startSignatureChain = useCallback(async () => {
    if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const doc = await repository.create(payload);
      docIdRef.current = doc.get('id');
      setSavedDocId(doc.get('id'));
      setCurrentStep(0);
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[VitaminScreen] Create failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [
    selectedLine, selectedMachine, selectedShift, operatorId,
    buildPayload, repository,
  ]);

  // ─── Update existing document ──────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!savedDocId) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      await repository.update(savedDocId, payload);
      await refreshSigs();
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[VitaminScreen] Save failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [savedDocId, buildPayload, repository, refreshSigs]);

  // ─── Signature handlers ────────────────────────────────────────────────────

  const handleSign = useCallback(async () => {
    const success = await doSign();
    if (success) {
      if (sigStatus.nextRole === null) {
        setShowSignature(false);
        setCurrentStep(0);
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [doSign, sigStatus.nextRole]);

  const handleSkipSignature = useCallback(() => {
    setShowSignature(false);
  }, []);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderNumericInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options?: { disabled?: boolean; suffix?: string; placeholder?: string }
  ) => (
    <TextInput
      mode="outlined"
      label={options?.suffix ? `${label} (${options.suffix})` : label}
      value={value}
      onChangeText={(text) => onChange(parseNumeric(text).toString())}
      keyboardType="decimal-pad"
      disabled={options?.disabled ?? !!savedDocId}
      placeholder={options?.placeholder}
      style={styles.input}
    />
  );

  const renderTextInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <TextInput
      mode="outlined"
      label={label}
      value={value}
      onChangeText={onChange}
      disabled={!!savedDocId}
      style={styles.input}
    />
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Vitaminas (F-PD-06)
        </Text>

        {savedDocId && (
          <Text variant="bodySmall" style={styles.statusHint}>
            Guardado — firmas pendientes
          </Text>
        )}

        {/* Products — VF-1, VF-2 */}
        {products.map((product, pIndex) => (
          <Card key={pIndex} style={styles.card}>
            <Card.Title title={`Producto ${pIndex + 1}`} />
            <Card.Content>
              {renderTextInput('# Orden', product.orden, (v) => updateProduct(pIndex, 'orden', v))}
              {renderTextInput('# Kit', product.kit, (v) => updateProduct(pIndex, 'kit', v))}
              {renderTextInput('Semi-terminado', product.semi_terminado, (v) => updateProduct(pIndex, 'semi_terminado', v))}

              <Divider style={styles.ingDivider} />

              {/* Ingredients with lotes */}
              <Text variant="titleSmall" style={styles.sectionSubtitle}>
                Ingredientes / Microingredientes
              </Text>
              {product.ingredients.map((ingredient, iIndex) => (
                <View key={iIndex} style={styles.ingredientRow}>
                  <View style={styles.ingredientFields}>
                    {renderTextInput('Nombre', ingredient.name, (v) =>
                      updateIngredient(pIndex, iIndex, 'name', v)
                    )}
                    <View style={styles.ingredientSubRow}>
                      <View style={styles.halfInput}>
                        {renderTextInput('Lote', ingredient.lote, (v) =>
                          updateIngredient(pIndex, iIndex, 'lote', v)
                        )}
                      </View>
                      <View style={styles.halfInput}>
                        {renderNumericInput('Cant.', ingredient.quantity_kg, (v) =>
                          updateIngredient(pIndex, iIndex, 'quantity_kg', v)
                        )}
                      </View>
                    </View>
                  </View>
                  <Button
                    compact
                    mode="text"
                    onPress={() => removeIngredient(pIndex, iIndex)}
                    disabled={!!savedDocId}
                    textColor="#C62828"
                  >
                    Eliminar
                  </Button>
                </View>
              ))}

              <Button
                mode="outlined"
                onPress={() => addIngredient(pIndex)}
                disabled={!!savedDocId}
                style={styles.addButton}
                compact
              >
                + Agregar Ingrediente
              </Button>
            </Card.Content>
          </Card>
        ))}

        {/* Add/Remove product buttons — VF-1 */}
        <View style={styles.productActions}>
          <Button
            mode="outlined"
            onPress={addProduct}
            disabled={products.length >= MAX_PRODUCTS || !!savedDocId}
            style={styles.productActionButton}
            compact
          >
            + Agregar Producto ({products.length}/{MAX_PRODUCTS})
          </Button>
          {products.length > 1 && (
            <Button
              mode="text"
              onPress={() => removeProduct(products.length - 1)}
              disabled={!!savedDocId}
              textColor="#C62828"
              style={styles.productActionButton}
              compact
            >
              Quitar Último
            </Button>
          )}
        </View>

        {/* Verifications — VF-3 */}
        <Card style={styles.card}>
          <Card.Title title="Verificaciones" />
          <Card.Content>
            <View style={styles.verifRow}>
              <Text variant="bodyMedium" style={styles.verifLabel}>
                Verif. Producción
              </Text>
              <Switch
                value={verifProduccion}
                onValueChange={setVerifProduccion}
                disabled={!!savedDocId}
              />
            </View>
            <View style={styles.verifRow}>
              <Text variant="bodyMedium" style={styles.verifLabel}>
                Verif. Calidad
              </Text>
              <Switch
                value={verifCalidad}
                onValueChange={setVerifCalidad}
                disabled={!!savedDocId}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Weight — VF-4 */}
        <Card style={styles.card}>
          <Card.Title title="Pesos" />
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderNumericInput('Peso Báscula', pesoBascula, setPesoBascula, {
                  suffix: 'kg',
                })}
              </View>
              <View style={styles.halfInput}>
                {renderNumericInput('Peso Físico', pesoFisico, setPesoFisico, {
                  suffix: 'kg',
                })}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Signature status — FS-7 */}
        {savedDocId && (
          <Card style={styles.card}>
            <Card.Title title="Estado de Firmas" />
            <Card.Content>
              {sigLoading ? (
                <ActivityIndicator />
              ) : (
                sigStatus.steps.map((step, index) => (
                  <View key={index} style={styles.sigStepRow}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.sigStepLabel,
                        step.status === 'signed' && styles.sigStepSigned,
                      ]}
                    >
                      {step.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.sigStepStatus,
                        step.status === 'signed'
                          ? styles.sigStepComplete
                          : styles.sigStepPending,
                      ]}
                    >
                      {step.status === 'signed'
                        ? '✓ Firmado'
                        : '— Pendiente'}
                    </Text>
                  </View>
                ))
              )}
              {sigError && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {sigError}
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={savedDocId ? handleSave : startSignatureChain}
          loading={saving}
          disabled={saving || !selectedShift || !operatorId}
          style={styles.saveButton}
        >
          {savedDocId ? 'Guardar Cambios' : 'Guardar y Firmar'}
        </Button>

        {savedDocId && !sigStatus.isComplete && (
          <Button
            mode="outlined"
            onPress={() => setShowSignature(true)}
            disabled={sigLoading}
            style={styles.signButton}
          >
            Firmar
          </Button>
        )}
      </View>

      {/* Signature Prompt — VF-5 */}
      {savedDocId && (
        <SignaturePrompt
          visible={showSignature}
          signature={{
            documentType: 'vitamin_kit',
            documentId: savedDocId,
            requiredRoles: [CHAIN_CONFIG.roles[currentStep]],
            sequence: currentStep + 1,
            stepLabel: CHAIN_CONFIG.labels[currentStep],
          }}
          currentRole={currentRole}
          currentUserName={fullName ?? ''}
          existingSignatures={sigStatus.steps
            .filter((s) => s.status === 'signed')
            .map((s) => ({
              signer_name: s.signerName ?? '',
              signer_role: s.role,
              signed_at: s.signedAt ?? 0,
              sequence:
                sigStatus.steps.findIndex((step) => step.role === s.role) + 1,
            }))}
          onSign={handleSign}
          onSkip={handleSkipSignature}
          onDismiss={handleSkipSignature}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  title: {
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 16,
  },
  statusHint: {
    color: '#F57F17',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  sectionSubtitle: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
    color: '#5D4037',
  },
  ingDivider: {
    marginVertical: 12,
  },
  ingredientRow: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ingredientFields: {
    flex: 1,
  },
  ingredientSubRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    marginTop: 8,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  productActionButton: {
    flex: 1,
  },
  verifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  verifLabel: {
    flex: 1,
  },
  sigStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sigStepLabel: {
    flex: 1,
  },
  sigStepSigned: {
    fontWeight: '600',
  },
  sigStepStatus: {
    fontWeight: '600',
  },
  sigStepPending: {
    color: '#9E9E9E',
  },
  sigStepComplete: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
  signButton: {
    flex: 1,
  },
});
