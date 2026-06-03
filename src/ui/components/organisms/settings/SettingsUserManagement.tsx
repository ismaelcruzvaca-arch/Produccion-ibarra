/**
 * SettingsUserManagement — user management section for the settings screen.
 *
 * Three role-gated states:
 * - admin: full CRUD — user list, create, edit, deactivate
 * - supervisor: read-only user list (no create/edit controls)
 * - operator: section not rendered
 *
 * Pattern: Same organism contract as SettingsCatalogs.tsx
 * Why: Consistent admin panel layout in the settings ScrollView.
 *
 * Data flow:
 * - Fetch all operator_profiles with line/plant assignments via getAllUsers()
 * - Fetch lines from catalogStore for the line multi-selector
 * - Create: admin-manage-user (Nhost Function) → GraphQL inserts
 * - Edit: updateOperatorProfile + manage line assignments
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Button,
  Chip,
  Dialog,
  Portal,
  TextInput,
  Switch,
  Checkbox,
  IconButton,
  ActivityIndicator,
  RadioButton,
} from 'react-native-paper';

import { useAuthStore } from '../../../../auth/useAuthStore';
import { useCatalogStore } from '../../../store/catalogStore';
import {
  getAllUsers,
  insertOperatorProfile,
  updateOperatorProfile,
  insertUserLineAssignment,
  deleteUserLineAssignment,
  createFullUser,
  generateOperatorDummyEmail,
  type OperatorProfileWithAssignments,
} from '../../../../graphql/userMutations';
import type { ICatalogLine } from '../../../../core/types';

// ─── Role Badge Colors ─────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  operator: '#1565C0',     // blue
  supervisor: '#EF6C00',   // orange
  admin: '#C62828',        // red
};

const ROLE_LABELS: Record<string, string> = {
  operator: 'Operador',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function SettingsUserManagement() {
  const role = useAuthStore((s) => s.role);

  // Hide entirely for operators
  if (role === 'operator') return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Gestión de Usuarios
      </Text>
      {role === 'admin' ? (
        <AdminUserManager />
      ) : (
        <ReadOnlyUserList />
      )}
    </View>
  );
}

// ─── Admin View ────────────────────────────────────────────────────────────────

function AdminUserManager() {
  const [users, setUsers] = useState<OperatorProfileWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editUser, setEditUser] = useState<OperatorProfileWithAssignments | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUsers();
      if (data) {
        setUsers(data);
      } else {
        setError('Error al cargar usuarios');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = useCallback(() => {
    setEditUser(null);
    setDialogVisible(true);
  }, []);

  const openEdit = useCallback((user: OperatorProfileWithAssignments) => {
    setEditUser(user);
    setDialogVisible(true);
  }, []);

  const handleSaved = useCallback(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <View>
      {/* Header with add button */}
      <View style={styles.headerRow}>
        <Text variant="bodySmall" style={styles.subtitle}>
          {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
        </Text>
        <Button
          mode="contained"
          compact
          icon="plus"
          onPress={openCreate}
          style={styles.addButton}
          labelStyle={styles.addButtonLabel}
        >
          Agregar
        </Button>
      </View>

      {/* Loading */}
      {loading && (
        <ActivityIndicator style={styles.loading} size="small" />
      )}

      {/* Error */}
      {error && (
        <Text variant="bodySmall" style={styles.errorText}>
          {error}
        </Text>
      )}

      {/* User List */}
      {!loading && users.length === 0 && !error && (
        <Text variant="bodyMedium" style={styles.emptyText}>
          Sin usuarios registrados
        </Text>
      )}

      {!loading && users.length > 0 && (
        <View style={styles.list}>
          {users.map((user) => (
            <View key={user.id} style={styles.userRow}>
              <View style={styles.userInfo}>
                <Text variant="bodyMedium" style={styles.userName}>
                  {user.full_name ?? 'Sin nombre'}
                </Text>
                <View style={styles.userMeta}>
                  <Chip
                    mode="flat"
                    compact
                    style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] ?? '#757575' }]}
                    textStyle={styles.roleBadgeText}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Chip>
                  <Text variant="bodySmall" style={styles.lineCount}>
                    {user.user_line_assignments.length} línea{user.user_line_assignments.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => openEdit(user)}
              />
            </View>
          ))}
        </View>
      )}

      {/* Create / Edit Dialog */}
      <UserFormDialog
        visible={dialogVisible}
        editUser={editUser}
        onDismiss={() => {
          setDialogVisible(false);
          setEditUser(null);
        }}
        onSaved={handleSaved}
      />
    </View>
  );
}

// ─── Supervisor Read-Only View ─────────────────────────────────────────────────

function ReadOnlyUserList() {
  const [users, setUsers] = useState<OperatorProfileWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then((data) => {
      if (data) setUsers(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <ActivityIndicator style={styles.loading} size="small" />;
  }

  if (users.length === 0) {
    return (
      <Text variant="bodyMedium" style={styles.emptyText}>
        Sin usuarios registrados
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {users.map((user) => (
        <View key={user.id} style={styles.userRow}>
          <View style={styles.userInfo}>
            <Text variant="bodyMedium" style={styles.userName}>
              {user.full_name ?? 'Sin nombre'}
            </Text>
            <View style={styles.userMeta}>
              <Chip
                mode="flat"
                compact
                style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] ?? '#757575' }]}
                textStyle={styles.roleBadgeText}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </Chip>
              <Text variant="bodySmall" style={styles.lineCount}>
                {user.user_line_assignments.length} línea{user.user_line_assignments.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Create / Edit Dialog ──────────────────────────────────────────────────────

interface UserFormDialogProps {
  visible: boolean;
  editUser: OperatorProfileWithAssignments | null;
  onDismiss: () => void;
  onSaved: () => void;
}

function UserFormDialog({ visible, editUser, onDismiss, onSaved }: UserFormDialogProps) {
  const isEditing = !!editUser;

  // Form fields
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('operator');
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Available lines from catalogStore
  const lines = useCatalogStore((s) => s.lines);

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      if (editUser) {
        setFullName(editUser.full_name ?? '');
        setSelectedRole(editUser.role);
        setEmail('');
        setIsActive(true);
        setSelectedLineIds(editUser.user_line_assignments.map((a) => a.line_id));
      } else {
        setFullName('');
        setSelectedRole('operator');
        setEmail('');
        setIsActive(true);
        setSelectedLineIds([]);
      }
      setSaveError(null);
      setSaving(false);
    }
  }, [visible, editUser]);

  // Toggle a line in the multi-select
  const toggleLine = useCallback((lineId: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId)
        ? prev.filter((id) => id !== lineId)
        : [...prev, lineId],
    );
  }, []);

  // Auto-generate email for operators
  const displayEmail = email || (selectedRole === 'operator' ? '(auto-generado)' : '');

  const handleSave = useCallback(async () => {
    // Validate required fields
    if (!fullName.trim()) {
      setSaveError('El nombre completo es requerido');
      return;
    }

    // For non-operator: email is required
    if (selectedRole !== 'operator' && !email.trim()) {
      setSaveError('El correo electrónico es requerido para supervisores y administradores');
      return;
    }

    // For operator: line selection is required
    if (selectedRole === 'operator' && selectedLineIds.length === 0) {
      setSaveError('Debe asignar al menos una línea para operadores');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      if (isEditing && editUser) {
        // ── Edit Mode ─────────────────────────────────────────────────
        const ok = await updateOperatorProfile(editUser.id, {
          full_name: fullName.trim(),
          role: selectedRole,
        });

        if (!ok) {
          setSaveError('Error al actualizar el perfil');
          setSaving(false);
          return;
        }

        // Sync line assignments: remove old, add new
        const currentLineIds = editUser.user_line_assignments.map((a) => a.line_id);
        const toRemove = currentLineIds.filter((id) => !selectedLineIds.includes(id));
        const toAdd = selectedLineIds.filter((id) => !currentLineIds.includes(id));

        for (const lineId of toRemove) {
          await deleteUserLineAssignment(editUser.id, lineId);
        }
        for (const lineId of toAdd) {
          await insertUserLineAssignment({
            user_id: editUser.id,
            line_id: lineId,
          });
        }
      } else {
        // ── Create Mode ───────────────────────────────────────────────
        const resolvedEmail = selectedRole === 'operator'
          ? generateOperatorDummyEmail()
          : email.trim();

        const userId = await createFullUser({
          email: resolvedEmail,
          fullName: fullName.trim(),
          role: selectedRole,
          lineIds: selectedRole === 'operator' ? selectedLineIds : undefined,
        });

        if (!userId) {
          setSaveError('Error al crear el usuario. Verifique que el correo no esté duplicado.');
          setSaving(false);
          return;
        }

        // For non-operator: insert line assignments if any were selected
        if (selectedRole !== 'operator' && selectedLineIds.length > 0) {
          for (const lineId of selectedLineIds) {
            await insertUserLineAssignment({
              user_id: userId,
              line_id: lineId,
            });
          }
        }
      }

      onSaved();
      onDismiss();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [fullName, selectedRole, email, selectedLineIds, isEditing, editUser, onSaved, onDismiss]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>
          {isEditing ? 'Editar Usuario' : 'Agregar Usuario'}
        </Dialog.Title>

        <Dialog.Content>
          {/* Full Name */}
          <TextInput
            mode="outlined"
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            disabled={saving}
          />

          {/* Role Selector */}
          <Text variant="bodySmall" style={styles.fieldLabel}>Rol</Text>
          <View style={styles.roleSelector}>
            {['operator', 'supervisor', 'admin'].map((r) => (
              <Chip
                key={r}
                mode="flat"
                compact
                selected={selectedRole === r}
                showSelectedCheck
                onPress={() => setSelectedRole(r)}
                style={[
                  styles.roleOption,
                  selectedRole === r && { backgroundColor: (ROLE_COLORS[r] ?? '#757575') + '22' },
                ]}
                textStyle={[
                  styles.roleOptionText,
                  selectedRole === r && { color: ROLE_COLORS[r] ?? '#757575' },
                ]}
                disabled={saving}
              >
                {ROLE_LABELS[r] ?? r}
              </Chip>
            ))}
          </View>

          {/* Email (required for supervisor/admin, hidden for operator) */}
          {selectedRole !== 'operator' && (
            <TextInput
              mode="outlined"
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              disabled={saving}
              placeholder="usuario@empresa.com"
            />
          )}
          {selectedRole === 'operator' && (
            <Text variant="bodySmall" style={styles.autoEmailHint}>
              Se generará un correo automático: operario-XXXXXX@ibarra.local
            </Text>
          )}

          {/* Line Multi-Select */}
          <Text variant="bodySmall" style={styles.fieldLabel}>
            Líneas asignadas
            {selectedRole === 'operator' && <Text style={styles.required}> *</Text>}
          </Text>
          {lines.length === 0 ? (
            <Text variant="bodySmall" style={styles.noLinesText}>
              No hay líneas disponibles
            </Text>
          ) : (
            <View style={styles.lineList}>
              {lines.map((line: ICatalogLine) => (
                <View key={line.id} style={styles.lineRow}>
                  <Checkbox
                    status={selectedLineIds.includes(line.id) ? 'checked' : 'unchecked'}
                    onPress={() => toggleLine(line.id)}
                    disabled={saving}
                  />
                  <Text
                    variant="bodyMedium"
                    style={styles.lineLabel}
                    onPress={() => toggleLine(line.id)}
                  >
                    {line.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Error */}
          {saveError && (
            <Text variant="bodySmall" style={styles.errorText}>
              {saveError}
            </Text>
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onPress={handleSave}
            loading={saving}
            mode="contained"
          >
            {isEditing ? 'Guardar' : 'Crear Usuario'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#757575',
  },
  addButton: {
    borderRadius: 6,
  },
  addButtonLabel: {
    fontSize: 12,
  },
  loading: {
    paddingVertical: 24,
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: '500',
    color: '#212121',
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    height: 26,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
  },
  lineCount: {
    color: '#757575',
  },
  dialog: {
    maxWidth: 420,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  fieldLabel: {
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
    marginTop: 4,
  },
  required: {
    color: '#C62828',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleOption: {
    flex: 1,
    justifyContent: 'center',
  },
  roleOptionText: {
    fontSize: 12,
  },
  autoEmailHint: {
    color: '#757575',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  noLinesText: {
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  lineList: {
    marginBottom: 8,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
  },
  lineLabel: {
    color: '#424242',
    flex: 1,
  },
});
