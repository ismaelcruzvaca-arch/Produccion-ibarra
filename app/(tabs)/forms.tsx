/**
 * Forms tab — FormRouter entry screen.
 *
 * Resolves the current machine to a form type using substring matching and
 * renders the appropriate form component. Defaults to OEE when no specific
 * form is matched.
 *
 * Spec FR-1: resolves form from machine_id
 * Spec FR-2: defaults to OEE when no station match
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { resolveFormType } from '../../src/core/formRouter';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import OeeScreen from '../../src/ui/components/organisms/OeeScreen';
import ExtractorScreen from '../../src/ui/components/organisms/ExtractorScreen';
import ToasterScreen from '../../src/ui/components/organisms/ToasterScreen';
import MixingScreen from '../../src/ui/components/organisms/MixingScreen';
import VitaminScreen from '../../src/ui/components/organisms/VitaminScreen';

const FORM_LABELS: Record<string, string> = {
  oee: 'OEE (F-PD-21)',
  toaster: 'Tostador (F-PD-16)',
  mixing: 'Mezcladora (F-PD-17)',
  extractor: 'Extractor (F-PD-18)',
  vitamin: 'Vitaminas (F-PD-06)',
};

/**
 * Placeholder screen for forms not yet implemented.
 * Shows the form name so operators know which form will load.
 */
function FormPlaceholder({ formType }: { formType: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>
        {FORM_LABELS[formType] ?? formType}
      </Text>
      <Text style={styles.placeholderSubtitle}>
        Este formulario estará disponible próximamente.
      </Text>
    </View>
  );
}

export default function FormsScreen() {
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);
  const getMachineById = useCatalogStore((s) => s.getMachineById);

  // Resolve machine name
  const machineName = selectedMachine
    ? (getMachineById(selectedMachine)?.name ?? '')
    : '';

  const formType = resolveFormType(machineName);

  // Render the appropriate form
  switch (formType) {
    case 'oee':
      return <OeeScreen />;
    case 'toaster':
      return <ToasterScreen />;
    case 'extractor':
      return <ExtractorScreen />;
    case 'mixing':
      return <MixingScreen />;
    case 'vitamin':
      return <VitaminScreen />;
    default:
      return <OeeScreen />;
  }
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 12,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
});
