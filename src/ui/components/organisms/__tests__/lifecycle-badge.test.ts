/**
 * Tests for the lifecycle_phase badge rendering logic (wo-lifecycle-integration).
 *
 * Tests the lifecyclePhaseColors color map and the renderLifecyclePhaseBadge
 * function that lives in ConciliationScreen.tsx.
 *
 * We duplicate the logic inline (same pattern as useDowntimeConciliation.test.ts)
 * to avoid pulling in the full React Native / Expo dependency chain.
 */

// ─── Color map (duplicated from ConciliationScreen.tsx:132-140) ──────────────

const lifecyclePhaseColors: Record<string, { bg: string; fg: string }> = {
  PLANN: { bg: '#E5E7EB', fg: '#374151' },
  SCHED: { bg: '#DBEAFE', fg: '#1D4ED8' },
  INPRG: { bg: '#FFEDD5', fg: '#C2410C' },
  INREV: { bg: '#FEF9C3', fg: '#A16207' },
  COMP:  { bg: '#DCFCE7', fg: '#15803D' },
  CLOSD: { bg: '#9CA3AF', fg: '#FFFFFF' },
  CNCLD: { bg: '#FEE2E2', fg: '#DC2626' },
};

const DEFAULT_COLORS = { bg: '#F3F4F6', fg: '#6B7280' };

function getBadgeColors(phase?: string): { bg: string; fg: string } {
  if (!phase) return DEFAULT_COLORS;
  return lifecyclePhaseColors[phase] ?? DEFAULT_COLORS;
}

function shouldShowBadge(cmmsWoId?: string): boolean {
  return !!cmmsWoId;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('lifecyclePhaseColors map', () => {
  it('cubre todas las 7 fases ISO 14224', () => {
    const phases = ['PLANN', 'SCHED', 'INPRG', 'INREV', 'COMP', 'CLOSD', 'CNCLD'];
    for (const phase of phases) {
      expect(lifecyclePhaseColors[phase]).toBeDefined();
      expect(lifecyclePhaseColors[phase].bg).toBeTruthy();
      expect(lifecyclePhaseColors[phase].fg).toBeTruthy();
    }
    expect(Object.keys(lifecyclePhaseColors)).toHaveLength(7);
  });

  it('cada fase tiene bg y fg diferentes', () => {
    for (const [phase, colors] of Object.entries(lifecyclePhaseColors)) {
      expect(colors.bg).not.toBe(colors.fg);
      expect(colors.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('PLANN tiene colores grises claros', () => {
    const colors = getBadgeColors('PLANN');
    expect(colors.bg).toBe('#E5E7EB');
    expect(colors.fg).toBe('#374151');
  });

  it('COMP tiene colores verdes', () => {
    const colors = getBadgeColors('COMP');
    expect(colors.bg).toBe('#DCFCE7');
    expect(colors.fg).toBe('#15803D');
  });

  it('CNCLD tiene colores rojos', () => {
    const colors = getBadgeColors('CNCLD');
    expect(colors.bg).toBe('#FEE2E2');
    expect(colors.fg).toBe('#DC2626');
  });
});

describe('getBadgeColors', () => {
  it('retorna default para fase desconocida', () => {
    const colors = getBadgeColors('UNKNOWN_PHASE');
    expect(colors).toEqual(DEFAULT_COLORS);
  });

  it('retorna default para undefined', () => {
    const colors = getBadgeColors(undefined);
    expect(colors).toEqual(DEFAULT_COLORS);
  });

  it('retorna default para empty string', () => {
    const colors = getBadgeColors('');
    expect(colors).toEqual(DEFAULT_COLORS);
  });

  it('retorna colores correctos para INPRG', () => {
    const colors = getBadgeColors('INPRG');
    expect(colors.bg).toBe('#FFEDD5');
    expect(colors.fg).toBe('#C2410C');
  });

  it('retorna colores correctos para SCHED', () => {
    const colors = getBadgeColors('SCHED');
    expect(colors.bg).toBe('#DBEAFE');
    expect(colors.fg).toBe('#1D4ED8');
  });
});

describe('shouldShowBadge', () => {
  it('muestra badge cuando cmms_wo_id está presente', () => {
    expect(shouldShowBadge('cmms-wo-456')).toBe(true);
  });

  it('NO muestra badge cuando cmms_wo_id es undefined', () => {
    expect(shouldShowBadge(undefined)).toBe(false);
  });

  it('NO muestra badge cuando cmms_wo_id es empty string', () => {
    expect(shouldShowBadge('')).toBe(false);
  });

  it('NO muestra badge cuando cmms_wo_id es null', () => {
    expect(shouldShowBadge(null as unknown as string)).toBe(false);
  });
});

describe('lifecycle phases — integración con badge', () => {
  it('todas las fases ISO tienen colores únicos y diferenciados', () => {
    const allBgs = Object.values(lifecyclePhaseColors).map((c) => c.bg);
    const allFgs = Object.values(lifecyclePhaseColors).map((c) => c.fg);

    // Verify all backgrounds are different from each other
    const uniqueBgs = new Set(allBgs);
    expect(uniqueBgs.size).toBe(allBgs.length);

    // Verify no background is the same as default
    expect(allBgs).not.toContain(DEFAULT_COLORS.bg);
  });
});
