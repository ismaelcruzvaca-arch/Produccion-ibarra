/**
 * Shift Close Screen — Route wrapper for ShiftCloseScreen.
 *
 * Receives shift_session_id from route params and renders the ShiftCloseScreen organism.
 * The supervisor classifies stops (planned/unplanned), reviews production summary,
 * and confirms the shift close.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ShiftCloseScreen } from '../../../../src/ui/components/organisms/ShiftCloseScreen';

export default function ShiftCloseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null; // Will be caught by the error boundary or parent layout
  }

  return <ShiftCloseScreen shiftSessionId={id} />;
}
