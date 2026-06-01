/**
 * T2.1 — formRouter pure function tests.
 *
 * Spec scenarios:
 * - S1: Tostador 01 → 'toaster'
 * - S2: Cavemil → 'oee'
 * - S3: No machine_id → 'oee' (default)
 *
 * Design: machine name substring matching.
 * Machine name → FormType mapping:
 * - "Tostador" → 'toaster' (F-PD-16)
 * - "Mezcladora" → 'mixing' (F-PD-17)
 * - "Extractor" → 'extractor' (F-PD-18)
 * - "Vitamin" → 'vitamin' (F-PD-06)
 * - Everything else → 'oee' (default / F-PD-21)
 */

import { resolveFormType, type FormType } from '../formRouter';

describe('resolveFormType', () => {
  describe('spec scenarios', () => {
    it('S1: Tostador 01 → toaster (F-PD-16)', () => {
      expect(resolveFormType('Tostador 01')).toBe('toaster');
      expect(resolveFormType('Tostador 02')).toBe('toaster');
    });

    it('S2: Cavemil → oee (F-PD-21)', () => {
      expect(resolveFormType('Cavemil')).toBe('oee');
      expect(resolveFormType('Cavemil-03')).toBe('oee');
    });

    it('S3: No machine_id → oee (default)', () => {
      expect(resolveFormType('')).toBe('oee');
    });
  });

  describe('substring matching — all form types', () => {
    it('matches Tostador substring to toaster', () => {
      expect(resolveFormType('Tostador A')).toBe('toaster');
      expect(resolveFormType('TOSTADOR')).toBe('toaster');
      expect(resolveFormType('tostador electrico')).toBe('toaster');
    });

    it('matches Mezcladora substring to mixing', () => {
      expect(resolveFormType('Mezcladora 01')).toBe('mixing');
      expect(resolveFormType('Mezcladora Principal')).toBe('mixing');
      expect(resolveFormType('MEZCLADORA')).toBe('mixing');
    });

    it('matches Extractor substring to extractor', () => {
      expect(resolveFormType('Extractor 01')).toBe('extractor');
      expect(resolveFormType('Extractor de grasa')).toBe('extractor');
      expect(resolveFormType('EXTRACTOR')).toBe('extractor');
    });

    it('matches Vitamin substring to vitamin', () => {
      expect(resolveFormType('Vitamin Kit A')).toBe('vitamin');
      expect(resolveFormType('Vitamina')).toBe('vitamin');
      expect(resolveFormType('VITAMIN')).toBe('vitamin');
    });

    it('matches Agitador substring to mixing', () => {
      expect(resolveFormType('Agitador 01')).toBe('mixing');
    });
  });

  describe('unknown machine names default to oee', () => {
    it('returns oee for unknown machine', () => {
      expect(resolveFormType('Molino')).toBe('oee');
      expect(resolveFormType('Banda Transportadora')).toBe('oee');
      expect(resolveFormType('Cavemil-03')).toBe('oee');
    });

    it('returns oee when machine name is whitespace only', () => {
      expect(resolveFormType('   ')).toBe('oee');
    });
  });

  describe('FormType union type', () => {
    it('accepts all valid form types', () => {
      const types: FormType[] = ['oee', 'toaster', 'mixing', 'extractor', 'vitamin'];
      types.forEach((type) => {
        expect(resolveFormType(type === 'toaster' ? 'Tostador' : type === 'mixing' ? 'Mezcladora' : type === 'extractor' ? 'Extractor' : type === 'vitamin' ? 'Vitamin' : 'Unknown')).toBe(type);
      });
    });
  });
});
