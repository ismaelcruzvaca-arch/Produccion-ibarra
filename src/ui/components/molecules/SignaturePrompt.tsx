/**
 * SignaturePrompt — tap-to-confirm dialog for digital signatures.
 *
 * Spec compliance (FS-1 through FS-5):
 * - FS-1: SHALL tap-to-confirm (name + role + timestamp) before finalizing
 * - FS-2: SHALL support multiple signer roles in configured sequence
 * - FS-3: SHALL confirmation dialog with signer identity before commit
 * - FS-5: SHALL validate current role matches required role
 * - FS-7: SHALL display signature status (pending/signed) per role
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Portal, Dialog, Chip, Divider, ActivityIndicator } from 'react-native-paper';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SignatureInfo {
  /** Type of document being signed (e.g., 'quality_inspection', 'oee_report'). */
  documentType: string;
  /** UUID of the document being signed. */
  documentId: string;
  /** Roles that are allowed to sign this document (e.g., ['supervisor', 'admin']). */
  requiredRoles: string[];
  /** Ordinal position in multi-signer chain (1st, 2nd, 3rd, 4th). */
  sequence: number;
  /** Label for the signature step (e.g., "Firma del Supervisor"). */
  stepLabel: string;
}

interface SignaturePromptProps {
  /** Whether the signature prompt is visible. */
  visible: boolean;
  /** Signature context info. */
  signature: SignatureInfo;
  /** Current user's role (from useAuthStore). */
  currentRole: string | null;
  /** Current user's display name. */
  currentUserName: string;
  /** Whether signatures for this document already exist (FS-7). */
  existingSignatures: Array<{
    signer_name: string;
    signer_role: string;
    signed_at: number;
    sequence: number;
  }>;
  /** Called when the user confirms the signature. */
  onSign: () => Promise<void>;
  /** Called to skip/dismiss. */
  onSkip: () => void;
  /** Called to close. */
  onDismiss: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function SignaturePrompt({
  visible,
  signature,
  currentRole,
  currentUserName,
  existingSignatures,
  onSign,
  onSkip,
  onDismiss,
}: SignaturePromptProps) {
  const [signing, setSigning] = useState(false);

  const isRoleValid =
    currentRole !== null && signature.requiredRoles.includes(currentRole);

  // Check if this role has already signed
  const alreadySigned = existingSignatures.some(
    (s) => s.signer_role === currentRole && s.sequence === signature.sequence
  );

  const handleSign = useCallback(async () => {
    if (!isRoleValid || alreadySigned) return;
    setSigning(true);
    try {
      await onSign();
    } finally {
      setSigning(false);
    }
  }, [isRoleValid, alreadySigned, onSign]);

  const formattedDate = new Date().toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{signature.stepLabel}</Dialog.Title>
        <Dialog.Content>
          {/* Current user identity */}
          <View style={styles.identitySection}>
            <Text variant="bodySmall" style={styles.label}>Firmante</Text>
            <Text variant="titleMedium" style={styles.name}>
              {currentUserName || 'Sin nombre'}
            </Text>
            <Chip
              style={[
                styles.roleChip,
                isRoleValid
                  ? { backgroundColor: '#E8F5E9' }
                  : { backgroundColor: '#FFEBEE' },
              ]}
              textStyle={{
                color: isRoleValid ? '#2E7D32' : '#C62828',
                fontWeight: '600',
              }}
              compact
            >
              {currentRole ?? 'Sin rol'}
            </Chip>
          </View>

          <Divider style={styles.divider} />

          {/* Role validation */}
          {!isRoleValid && (
            <View style={styles.errorSection}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text variant="bodyMedium" style={styles.errorText}>
                Su rol ({currentRole ?? 'ninguno'}) no está autorizado para firmar este documento.
                Roles requeridos: {signature.requiredRoles.join(', ')}.
              </Text>
            </View>
          )}

          {alreadySigned && (
            <View style={styles.errorSection}>
              <Text style={styles.errorIcon}>ℹ️</Text>
              <Text variant="bodyMedium" style={styles.errorText}>
                Ya ha firmado este documento en esta posición.
              </Text>
            </View>
          )}

          {/* Existing signatures (FS-7) */}
          {existingSignatures.length > 0 && (
            <View style={styles.existingSection}>
              <Text variant="bodySmall" style={styles.label}>
                Firmas registradas
              </Text>
              {existingSignatures.map((sig, index) => (
                <View key={index} style={styles.signatureRow}>
                  <Text variant="bodySmall" style={styles.signerName}>
                    {sig.signer_name}
                  </Text>
                  <Chip compact style={styles.signedChip} textStyle={styles.signedChipText}>
                    {sig.signer_role}
                  </Chip>
                </View>
              ))}
            </View>
          )}

          {/* Timestamp confirmation (FS-1, FS-3) */}
          <Divider style={styles.divider} />
          <View style={styles.timestampSection}>
            <Text variant="bodySmall" style={styles.label}>Fecha y hora</Text>
            <Text variant="bodyMedium">{formattedDate}</Text>
          </View>

          <Text variant="bodySmall" style={styles.confirmText}>
            Al confirmar, acepta que los datos ingresados son correctos y quedan registrados bajo su responsabilidad.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onSkip} disabled={signing}>
            Omitir
          </Button>
          <Button
            mode="contained"
            onPress={handleSign}
            disabled={!isRoleValid || alreadySigned || signing}
            loading={signing}
          >
            Firmar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  identitySection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    opacity: 0.6,
    marginBottom: 4,
  },
  name: {
    fontWeight: '700',
    marginBottom: 8,
  },
  roleChip: {
    height: 28,
  },
  divider: {
    marginVertical: 12,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    color: '#E65100',
  },
  existingSection: {
    marginBottom: 8,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  signerName: {
    flex: 1,
  },
  signedChip: {
    backgroundColor: '#E8F5E9',
    height: 24,
  },
  signedChipText: {
    fontSize: 11,
    color: '#2E7D32',
  },
  timestampSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmText: {
    textAlign: 'center',
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 12,
  },
});
