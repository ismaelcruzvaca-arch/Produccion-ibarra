/**
 * Product Weight Standards Repository Hook — FK validation cache for offline weight checks.
 *
 * Pattern: Repository + Offline Cache (OFL-2)
 * Why:
 * - Quality weight inspections need to validate against the product's weight standard.
 * - This must work OFFLINE — operators can't wait for network to check if 252g is valid.
 * - The repository caches weight standards locally via RxDB so validation works without network.
 * - Primary key is `sku` (natural key from Epicor), not UUID.
 *
 * Usage:
 *   const standardsRepo = useProductWeightStandardsRepository();
 *   const standard = await standardsRepo.findBySku('ABC-123');
 *   if (standard && weight < standard.lower_limit) { reject }
 *
 * Sync strategy: Pull-only from Hasura (reference data, never created on device).
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { nowMs } from '../utils/timestamp';
import type { IProductWeightStandard } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

export type CreateWeightStandardPayload = Omit<IProductWeightStandard, 'updated_at'>;

export interface ProductWeightStandardsRepository {
  /** Emits all non-deleted weight standards on change */
  docs$: Observable<RxDocument<IProductWeightStandard>[]>;

  /** Find standard by SKU (natural key from Epicor) */
  findBySku: (sku: string) => Promise<IProductWeightStandard | null>;

  /** Validate a weight against a product's standard. Returns null if valid, error message if invalid. */
  validateWeight: (sku: string, weightInGrams: number) => Promise<{ valid: boolean; message?: string }>;

  /** List all active standards */
  findAllActive: () => Promise<IProductWeightStandard[]>;

  /** Create/update a weight standard (admin/sync only) */
  upsert: (payload: CreateWeightStandardPayload & { sku?: string }) => Promise<RxDocument<IProductWeightStandard>>;
}

export function useProductWeightStandardsRepository(): ProductWeightStandardsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IProductWeightStandard>[]> = useMemo(
    () =>
      db.collections.product_weight_standards
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const findBySku = useCallback(
    async (sku: string) => {
      const doc = await db.collections.product_weight_standards.findOne(sku).exec();
      if (!doc) return null;
      return doc.toJSON() as IProductWeightStandard;
    },
    [db],
  );

  const validateWeight = useCallback(
    async (sku: string, weightInGrams: number): Promise<{ valid: boolean; message?: string }> => {
      const standard = await findBySku(sku);

      if (!standard) {
        // No standard configured — accept but warn
        return { valid: true, message: 'Sin estándar de peso configurado' };
      }

      if (weightInGrams < standard.lower_limit) {
        return {
          valid: false,
          message: `Peso (${weightInGrams}g) por debajo del mínimo (${standard.lower_limit}g)`,
        };
      }

      if (weightInGrams > standard.upper_limit) {
        return {
          valid: false,
          message: `Peso (${weightInGrams}g) excede el máximo (${standard.upper_limit}g)`,
        };
      }

      return { valid: true };
    },
    [findBySku],
  );

  const findAllActive = useCallback(async () => {
    const docs = await db.collections.product_weight_standards
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs.map((d) => d.toJSON() as IProductWeightStandard);
  }, [db]);

  const upsert = useCallback(
    async (payload: CreateWeightStandardPayload & { sku?: string }) => {
      const docSku = payload.sku ?? '';
      const existing = await db.collections.product_weight_standards.findOne(docSku).exec();

      if (existing) {
        await existing.patch({
          ...payload,
          updated_at: nowMs(),
        });
        return existing as RxDocument<IProductWeightStandard>;
      }

      const newDoc: IProductWeightStandard = {
        ...payload,
        updated_at: nowMs(),
      };
      const result = await db.collections.product_weight_standards.insert(newDoc);
      return result as RxDocument<IProductWeightStandard>;
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, findBySku, validateWeight, findAllActive, upsert }),
    [docs$, findBySku, validateWeight, findAllActive, upsert],
  );
}
