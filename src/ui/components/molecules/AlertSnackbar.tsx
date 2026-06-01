/**
 * AlertSnackbar — centralized snackbar system with type-based colors.
 *
 * Provides a Context + Provider + hook pattern so every screen can
 * show a styled snackbar without duplicating state.
 *
 * Supported types:
 * - success  (green)
 * - error    (red)
 * - info     (blue)
 * - warning  (orange)
 *
 * Exports:
 * - AlertSnackbarProvider — wraps the app, renders the Snackbar via Portal
 * - useAlertSnackbar()    — returns { showAlert }
 * - showAlert({ message, type })
 *
 * Usage:
 *   const { showAlert } = useAlertSnackbar();
 *   showAlert({ message: 'Turno iniciado', type: 'success' });
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface ShowAlertParams {
  message: string;
  type: AlertType;
}

interface AlertSnackbarContextValue {
  showAlert: (params: ShowAlertParams) => void;
}

// ─── Colors ────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<AlertType, string> = {
  success: '#4CAF50',
  error: '#D32F2F',
  info: '#1976D2',
  warning: '#F57C00',
};

// ─── Context ───────────────────────────────────────────────────────────────────

const AlertSnackbarContext = createContext<AlertSnackbarContextValue | null>(null);

/**
 * Hook to access showAlert from any screen within AlertSnackbarProvider.
 */
export function useAlertSnackbar(): AlertSnackbarContextValue {
  const ctx = useContext(AlertSnackbarContext);
  if (!ctx) {
    throw new Error(
      'useAlertSnackbar must be used within an AlertSnackbarProvider'
    );
  }
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

/**
 * Mount this once near the root of your navigation tree.
 * Renders a <Portal><Snackbar> that auto-dismisses after 3 s.
 */
export function AlertSnackbarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<AlertType>('info');

  const showAlert = useCallback(({ message, type }: ShowAlertParams) => {
    setMessage(message);
    setType(type);
    setVisible(true);
  }, []);

  const onDismiss = useCallback(() => setVisible(false), []);

  return (
    <AlertSnackbarContext.Provider value={{ showAlert }}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={3000}
        style={[styles.snackbar, { backgroundColor: TYPE_COLORS[type] }]}
      >
        {message}
      </Snackbar>
    </AlertSnackbarContext.Provider>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
