/**
 * useDowntimeTimer — Extracted timer logic from OeeDashboard.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Moves timer logic OUT of OeeDashboard component.
 * - Pure hook: no rendering logic, easy to test.
 *
 * Input:
 * - startTime: number | null — epoch ms timestamp when timer started
 * - isActive: boolean — whether timer should be running
 *
 * Returns:
 * - duration: number — elapsed time in milliseconds
 * - formattedDuration: string — HH:MM:SS formatted string
 */

import { useEffect, useState } from 'react';

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface UseDowntimeTimerInput {
  startTime: number | null;
  isActive: boolean;
}

interface UseDowntimeTimerReturn {
  duration: number;
  formattedDuration: string;
}

export function useDowntimeTimer({
  startTime,
  isActive,
}: UseDowntimeTimerInput): UseDowntimeTimerReturn {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setDuration(0);
      return;
    }

    const update = () => {
      setDuration(Date.now() - startTime);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return {
    duration,
    formattedDuration: formatDuration(duration),
  };
}
