/**
 * AppButton — Token-based wrapper around react-native-paper Button.
 *
 * Pattern: Atomic Design — Atom
 * Why:
 * - Replaces hardcoded buttonColor/textColor throughout the app.
 * - All colors are sourced from design tokens.
 * - Touch targets ≥56dp for industrial tablet with gloves.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { ButtonProps } from 'react-native-paper';
import { colors, borderRadius, touchTarget, typography } from '../../theme/tokens';

type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'success';

interface AppButtonProps extends Omit<ButtonProps, 'mode' | 'children'> {
  variant?: AppButtonVariant;
  mode?: 'text' | 'outlined' | 'contained' | 'contained-tonal';
  children: string;
}

const VARIANT_STYLES: Record<AppButtonVariant, { buttonColor?: string; textColor?: string }> = {
  primary: { buttonColor: colors.primary, textColor: colors.textOnPrimary },
  secondary: { buttonColor: undefined, textColor: colors.primary },
  danger: { buttonColor: colors.error, textColor: colors.textOnPrimary },
  warning: { buttonColor: colors.warning, textColor: '#000000' },
  success: { buttonColor: colors.success, textColor: colors.textOnPrimary },
};

export function AppButton({
  variant = 'primary',
  mode = 'contained',
  children,
  style,
  contentStyle,
  labelStyle,
  ...rest
}: AppButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Button
      mode={mode}
      buttonColor={variant === 'primary' || variant === 'danger' || variant === 'success' ? variantStyle.buttonColor : undefined}
      textColor={variant === 'warning' ? variantStyle.textColor : undefined}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[styles.label, labelStyle]}
      {...rest}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.sm,
  },
  content: {
    minHeight: touchTarget.minHeight,
  },
  label: {
    fontSize: typography.sizes.button,
    fontWeight: typography.weights.semibold,
  },
});
