/**
 * NumpadModal — Touch-friendly numerical keyboard for industrial tablets.
 *
 * Pattern: Thin Wrapper (delegates input+validation to SmartNumpad atom)
 * Why:
 * - AD-4: SmartNumpad has configurable validation (min, max, softLimit, precision).
 * - This component keeps the existing interface ({visible, title, onDismiss, onSubmit})
 *   while delegating all keyboard, display, and validation logic to SmartNumpad.
 * - All testIDs are preserved (SmartNumpad uses the same testIDs).
 *
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React from 'react';
import { SmartNumpad } from './atoms/SmartNumpad';
import { OEE_LIMITS } from '../../config/oeeLimits';

interface NumpadModalProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  onSubmit: (value: number) => void;
}

export function NumpadModal({ visible, title, onDismiss, onSubmit }: NumpadModalProps) {
  return (
    <SmartNumpad
      visible={visible}
      title={title}
      onDismiss={onDismiss}
      onConfirm={onSubmit}
      min={1}
      max={OEE_LIMITS.DEFAULT_HARD_LIMIT}
      softLimit={OEE_LIMITS.DEFAULT_SOFT_LIMIT}
      label="cajas"
      unit=" cajas"
    />
  );
}
