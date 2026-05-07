/**
 * Login screen for Chocolate Ibarra PRODUCCIÓN.
 *
 * Requirements:
 * - react-native-paper components only
 * - Touch targets ≥48 dp (industrial tablet optimised)
 * - minHeight 56 dp for primary action button
 * - Email + password with secureTextEntry
 * - Loading state and error display via HelperText
 * - Integrates with Nhost signInEmailPassword via useAuthStore
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  HelperText,
  useTheme,
} from 'react-native-paper';
import { useAuthStore } from '../src/auth/useAuthStore';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading, error } = useAuthStore();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    await signIn(email.trim(), password.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
          Chocolate Ibarra
        </Text>
        <Text variant="titleMedium" style={styles.subtitle}>
          PRODUCCIÓN
        </Text>
      </View>

      <TextInput
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        style={styles.input}
        disabled={isLoading}
        mode="outlined"
      />

      <TextInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        style={styles.input}
        disabled={isLoading}
        mode="outlined"
      />

      {error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}

      <Button
        mode="contained"
        onPress={handleSignIn}
        loading={isLoading}
        disabled={isLoading || !email.trim() || !password.trim()}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Iniciar Sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    color: '#757575',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 56,
  },
  button: {
    marginTop: 8,
    minHeight: 56,
  },
  buttonContent: {
    paddingVertical: 8,
    minHeight: 56,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
