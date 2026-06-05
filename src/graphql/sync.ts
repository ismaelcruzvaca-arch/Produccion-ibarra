/**
 * GraphQL replication setup for bidirectional sync.
 *
 * Pattern: Replication State Manager
 * Why:
 * - RxDB's replicateGraphQL() provides checkpoint-based pull and upsert push.
 * - A single startReplication() call wires up all collections.
 * - Replication runs in the background (polling) and merges remote docs into local RxDB.
 *
 * Sync strategy:
 * - Pull: Query Hasura for records where client_updated_at > last checkpoint,
 *         ordered ascending. RxDB upserts incoming docs (Last-Write-Wins on timestamps).
 * - Push: Send changed local docs via upsert mutation with on_conflict.
 *         Hasura constraint: <table>_pkey (e.g., assets_pkey, work_orders_pkey).
 * - Conflict resolution: Last-Write-Wins based on client_updated_at.
 *   The server's on_conflict clause updates the row if client_updated_at is newer.
 *
 * Auth: All replication requests use the authenticated user role.
 *       The Authorization: Bearer <token> header is injected via getAuthToken().
 */

import { replicateGraphQL, type RxGraphQLReplicationState } from 'rxdb/plugins/replication-graphql';

import { getAuthToken } from './nhostClient';
import {
  toGraphQLOeeEvent,
  fromGraphQLOeeEvent,
  toGraphQLSignature,
  fromGraphQLSignature,
  fromGraphQLOperator,
  fromGraphQLProductWeightStandard,
  fromGraphQLShiftSession,
  fromGraphQLDowntimeConciliation,
  fromGraphQLPlantConfig,
  fromGraphQLShiftSummary,
} from './dto';
import type { ChocolateIbarraDatabase } from '../data/database';
import type {
  IOperator,
  IProductWeightStandard,
  IShiftSession,
  IDowntimeConciliation,
  IPlantConfig,
  IShiftSummary,
} from '../core/types';
import { createResilientReplication, runDLQDiagnosis, type ResilientState } from '../sync/resilientReplication';

/**
 * GraphQL endpoint URL for Nhost (Hasura).
 * Format: https://<subdomain>.nhost.run/v1/graphql
 *
 * Uses EXPO_PUBLIC_ env vars so Expo inlines them into the client bundle.
 */
export function getGraphQLUrl(): string {
  const subdomain = process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN ?? 'your-nhost-subdomain';
  return `https://${subdomain}.nhost.run/v1/graphql`;
}

/**
 * Builds the headers object for replication requests.
 * Includes Content-Type and optionally the Bearer auth token.
 *
 * The token is extracted from the Nhost client's session (which handles refresh).
 * Replication uses raw fetch (not nhost.graphql.request) so we must inject manually.
 */
export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ─── Pull Query Builder (Assets) ───────────────────────────────────────────────

/**
 * Pull handler for assets — fetches records updated after the checkpoint.
 *
 * @param checkpoint - The last synced client_updated_at value (null for initial sync)
 * @returns Query object for replicateGraphQL's queryBuilder
 *
 * Checkpoint strategy:
 * - Initial sync (checkpoint=null): query all records (client_updated_at > 0)
 * - Subsequent syncs: query records where client_updated_at > last checkpoint
 * - Results ordered by client_updated_at ascending to avoid missing updates
 */
function pullQueryBuilderAssets(checkpoint: GraphQLAsset | undefined, _limit: number) {
  return {
    query: `
      query PullAssets($lastCheckpoint: bigint!) {
        assets(
          where: { client_updated_at: { _gt: $lastCheckpoint } },
          order_by: { client_updated_at: asc }
        ) {
          id
          name
          type_id
          status
          location
          serial_number
          manufacturer
          model_number
          in_service_date
          warranty_expiration
          client_updated_at
          deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.client_updated_at ? parseInt(checkpoint.client_updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Assets Upsert) ────────────────────────────────────

/**
 * Push handler for assets — sends changed documents to server via upsert mutation.
 *
 * Uses Hasura's insert ... on_conflict to handle both inserts and updates.
 * Constraint name: assets_pkey (Hasura standard naming: <table>_pkey)
 *
 * The update_columns array specifies which fields to update on conflict.
 * All mutable fields are included; id and client_updated_at are always updated
 * (client_updated_at drives LWW conflict resolution).
 */
function pushMutationBuilderAssets(docs: any[]) {
  const objects = docs.map(toGraphQLAsset);
  return {
    query: `
      mutation UpsertAssets($objects: [assets_insert_input!]!) {
        insert_assets(
          objects: $objects,
          on_conflict: {
            constraint: assets_pkey,
            update_columns: [
              name,
              type_id,
              status,
              location,
              serial_number,
              manufacturer,
              model_number,
              in_service_date,
              warranty_expiration,
              client_updated_at,
              deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Work Orders) ─────────────────────────────────────────

function pullQueryBuilderWorkOrders(checkpoint: GraphQLWorkOrder | undefined, _limit: number) {
  return {
    query: `
      query PullWorkOrders($lastCheckpoint: bigint!) {
        work_orders(
          where: { client_updated_at: { _gt: $lastCheckpoint } },
          order_by: { client_updated_at: asc }
        ) {
          id
          equipment_id
          description
          status
          priority
          assigned_to
          scheduled_date
          completed_date
          client_updated_at
          deleted
          lifecycle_phase
          symptom_note
          cause_note
          action_note
          actual_start_at
          completed_at
          cmms_wo_id
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.client_updated_at ? parseInt(checkpoint.client_updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Work Orders Upsert) ────────────────────────────────

function pushMutationBuilderWorkOrders(docs: any[]) {
  const objects = docs.map(toGraphQLWorkOrder);
  return {
    query: `
      mutation UpsertWorkOrders($objects: [work_orders_insert_input!]!) {
        insert_work_orders(
          objects: $objects,
          on_conflict: {
            constraint: work_orders_pkey,
            update_columns: [
              equipment_id,
              description,
              status,
              priority,
              assigned_to,
              scheduled_date,
              completed_date,
              client_updated_at,
              deleted,
              lifecycle_phase,
              symptom_note,
              cause_note,
              action_note,
              actual_start_at,
              completed_at,
              cmms_wo_id
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Reports) ──────────────────────────────────────────────

function pullQueryBuilderReports(checkpoint: GraphQLReport | undefined, _limit: number) {
  return {
    query: `
      query PullReports($lastCheckpoint: bigint!) {
        reports(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          updated_at
          deleted
          template_id
          data
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Reports Upsert) ─────────────────────────────────────

function pushMutationBuilderReports(docs: any[]) {
  const objects = docs.map(toGraphQLReport);
  return {
    query: `
      mutation UpsertReports($objects: [reports_insert_input!]!) {
        insert_reports(
          objects: $objects,
          on_conflict: {
            constraint: reports_pkey,
            update_columns: [
              updated_at,
              deleted,
              template_id,
              data
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (OEE Events) ───────────────────────────────────────────

function pullQueryBuilderOeeEvents(checkpoint: GraphQLOeeEvent | undefined, _limit: number) {
  return {
    query: `
      query PullOeeEvents($lastCheckpoint: bigint!) {
        oee_events(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          updated_at
          deleted
          line_id
          machine_id
          operator_id
          shift_id
          event_type
          timestamp
          reason_code
          quantity
          planned_boxes
          notes
          is_retroactive
          related_event_id
          device_id
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (OEE Events Upsert) ─────────────────────────────────

function pushMutationBuilderOeeEvents(docs: any[]) {
  const objects = docs.map(toGraphQLOeeEvent);
  return {
    query: `
      mutation UpsertOeeEvents($objects: [oee_events_insert_input!]!) {
        insert_oee_events(
          objects: $objects,
          on_conflict: {
            constraint: oee_events_pkey,
            update_columns: [
              updated_at, deleted, line_id, machine_id, operator_id,
              shift_id, event_type, timestamp, reason_code, quantity,
              planned_boxes, notes, is_retroactive, related_event_id, device_id
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Signatures) ──────────────────────────────────────────

function pullQueryBuilderSignatures(checkpoint: GraphQLSignature | undefined, _limit: number) {
  return {
    query: `
      query PullSignatures($lastCheckpoint: bigint!) {
        signatures(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          document_type
          document_id
          signer_id
          signer_name
          signer_role
          signed_at
          sequence
          is_deleted
          created_at
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Signatures Upsert) ─────────────────────────────────

function pushMutationBuilderSignatures(docs: any[]) {
  const objects = docs.map(toGraphQLSignature);
  return {
    query: `
      mutation UpsertSignatures($objects: [signatures_insert_input!]!) {
        insert_signatures(
          objects: $objects,
          on_conflict: {
            constraint: signatures_pkey,
            update_columns: [
              document_type, document_id, signer_id, signer_name,
              signer_role, signed_at, sequence, is_deleted,
              created_at, updated_at
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Quality Inspections) ─────────────────────────────────

// ─── Pull Query Builder (Defect Logs) ─────────────────────────────────────────

function pullQueryBuilderDefectLogs(checkpoint: GraphQLDefectLog | undefined, _limit: number) {
  return {
    query: `
      query PullDefectLogs($lastCheckpoint: bigint!) {
        defect_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          defect_type
          defect_code
          quantity
          severity
          notes
          registered_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Defect Logs Upsert) ────────────────────────────────

function pushMutationBuilderDefectLogs(docs: any[]) {
  const objects = docs.map(toGraphQLDefectLog);
  return {
    query: `
      mutation UpsertDefectLogs($objects: [defect_logs_insert_input!]!) {
        insert_defect_logs(
          objects: $objects,
          on_conflict: {
            constraint: defect_logs_pkey,
            update_columns: [
              inspection_id, defect_type, defect_code, quantity,
              severity, notes, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Weight Logs) ─────────────────────────────────────────

function pullQueryBuilderWeightLogs(checkpoint: GraphQLWeightLog | undefined, _limit: number) {
  return {
    query: `
      query PullWeightLogs($lastCheckpoint: bigint!) {
        weight_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          product_code
          target_weight
          actual_weight
          tolerance
          result
          registered_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Weight Logs Upsert) ────────────────────────────────

function pushMutationBuilderWeightLogs(docs: any[]) {
  const objects = docs.map(toGraphQLWeightLog);
  return {
    query: `
      mutation UpsertWeightLogs($objects: [weight_logs_insert_input!]!) {
        insert_weight_logs(
          objects: $objects,
          on_conflict: {
            constraint: weight_logs_pkey,
            update_columns: [
              inspection_id, product_code, target_weight,
              actual_weight, result, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Toaster Logs) ─────────────────────────────────────────

function pullQueryBuilderToasterLogs(checkpoint: GraphQLToasterLog | undefined, _limit: number) {
  return {
    query: `
      query PullToasterLogs($lastCheckpoint: bigint!) {
        toaster_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          line_id
          machine_id
          shift_id
          operator_id
          created_at
          updated_at
          is_deleted
          batch_number
          temp_superior
          temp_media
          temp_inferior
          rpm
          vapor_pressure
          cacao_crudo_humidity
          cacao_tostado_humidity
          pesadas
          silo
          lotes
          tiempo_muerto_min
          tiempo_muerto_cause
          inv_ini_cascarilla
          inv_ini_polvillo
          inv_ini_granilla
          inv_ini_cacao_crudo
          inv_ini_azucar
          inv_fin_cascarilla
          inv_fin_polvillo
          inv_fin_granilla
          inv_fin_cacao_crudo
          inv_fin_azucar
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Toaster Logs Upsert) ───────────────────────────────

function pushMutationBuilderToasterLogs(docs: any[]) {
  const objects = docs.map(toGraphQLToasterLog);
  return {
    query: `
      mutation UpsertToasterLogs($objects: [toaster_logs_insert_input!]!) {
        insert_toaster_logs(
          objects: $objects,
          on_conflict: {
            constraint: toaster_logs_pkey,
            update_columns: [
              line_id, machine_id, shift_id, operator_id,
              batch_number, temp_superior, temp_media, temp_inferior,
              rpm, vapor_pressure, cacao_crudo_humidity, cacao_tostado_humidity,
              pesadas, silo, lotes, tiempo_muerto_min, tiempo_muerto_cause,
              inv_ini_cascarilla, inv_ini_polvillo, inv_ini_granilla,
              inv_ini_cacao_crudo, inv_ini_azucar,
              inv_fin_cascarilla, inv_fin_polvillo, inv_fin_granilla,
              inv_fin_cacao_crudo, inv_fin_azucar,
              updated_at, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Mixing Batches) ───────────────────────────────────────

function pullQueryBuilderMixingBatches(checkpoint: GraphQLMixingBatch | undefined, _limit: number) {
  return {
    query: `
      query PullMixingBatches($lastCheckpoint: bigint!) {
        mixing_batches(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          line_id
          machine_id
          shift_id
          operator_id
          created_at
          updated_at
          is_deleted
          batch_sequence
          mezcladora
          agitador
          azucar_kg
          licor_kg
          cocoa_kg
          grasa_vegetal_kg
          lecitina_kg
          reproceso_kg
          viscosity_cps
          discharge_temp
          mezcladas
          molidas
          reproceso_total
          desperdicio
          inv_ini_azucar
          inv_ini_licor
          inv_ini_cocoa
          inv_ini_grasa_vegetal
          inv_ini_lecitina
          inv_ini_reproceso
          inv_fin_azucar
          inv_fin_licor
          inv_fin_cocoa
          inv_fin_grasa_vegetal
          inv_fin_lecitina
          inv_fin_reproceso
          consumo_azucar
          consumo_licor
          consumo_cocoa
          consumo_grasa_vegetal
          consumo_lecitina
          consumo_reproceso
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Mixing Batches Upsert) ─────────────────────────────

function pushMutationBuilderMixingBatches(docs: any[]) {
  const objects = docs.map(toGraphQLMixingBatch);
  return {
    query: `
      mutation UpsertMixingBatches($objects: [mixing_batches_insert_input!]!) {
        insert_mixing_batches(
          objects: $objects,
          on_conflict: {
            constraint: mixing_batches_pkey,
            update_columns: [
              line_id, machine_id, shift_id, operator_id,
              batch_sequence, mezcladora, agitador,
              azucar_kg, licor_kg, cocoa_kg, grasa_vegetal_kg,
              lecitina_kg, reproceso_kg,
              viscosity_cps, discharge_temp,
              mezcladas, molidas, reproceso_total, desperdicio,
              inv_ini_azucar, inv_ini_licor, inv_ini_cocoa,
              inv_ini_grasa_vegetal, inv_ini_lecitina, inv_ini_reproceso,
              inv_fin_azucar, inv_fin_licor, inv_fin_cocoa,
              inv_fin_grasa_vegetal, inv_fin_lecitina, inv_fin_reproceso,
              consumo_azucar, consumo_licor, consumo_cocoa,
              consumo_grasa_vegetal, consumo_lecitina, consumo_reproceso,
              updated_at, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Extractor Checks) ─────────────────────────────────────

function pullQueryBuilderExtractorChecks(checkpoint: GraphQLExtractorCheck | undefined, _limit: number) {
  return {
    query: `
      query PullExtractorChecks($lastCheckpoint: bigint!) {
        extractor_checks(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          line_id
          machine_id
          shift_id
          operator_id
          created_at
          updated_at
          is_deleted
          extractor_1_on
          extractor_2_on
          extractor_3_on
          extractor_4_on
          extractor_5_on
          extractor_6_on
          extractor_7_on
          extractor_8_on
          cedazo_tt_last_cleaning
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Extractor Checks Upsert) ───────────────────────────

function pushMutationBuilderExtractorChecks(docs: any[]) {
  const objects = docs.map(toGraphQLExtractorCheck);
  return {
    query: `
      mutation UpsertExtractorChecks($objects: [extractor_checks_insert_input!]!) {
        insert_extractor_checks(
          objects: $objects,
          on_conflict: {
            constraint: extractor_checks_pkey,
            update_columns: [
              line_id, machine_id, shift_id, operator_id,
              extractor_1_on, extractor_2_on, extractor_3_on,
              extractor_4_on, extractor_5_on, extractor_6_on,
              extractor_7_on, extractor_8_on,
              cedazo_tt_last_cleaning,
              updated_at, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Vitamin Kits) ─────────────────────────────────────────

function pullQueryBuilderVitaminKits(checkpoint: GraphQLVitaminKit | undefined, _limit: number) {
  return {
    query: `
      query PullVitaminKits($lastCheckpoint: bigint!) {
        vitamin_kits(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          line_id
          machine_id
          shift_id
          operator_id
          created_at
          updated_at
          is_deleted
          orden
          kit
          semi_terminado
          ingredients
          verif_produccion
          verif_calidad
          peso_bascula_kg
          peso_fisico_kg
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Vitamin Kits Upsert) ───────────────────────────────

function pushMutationBuilderVitaminKits(docs: any[]) {
  const objects = docs.map(toGraphQLVitaminKit);
  return {
    query: `
      mutation UpsertVitaminKits($objects: [vitamin_kits_insert_input!]!) {
        insert_vitamin_kits(
          objects: $objects,
          on_conflict: {
            constraint: vitamin_kits_pkey,
            update_columns: [
              line_id, machine_id, shift_id, operator_id,
              orden, kit, semi_terminado, ingredients,
              verif_produccion, verif_calidad,
              peso_bascula_kg, peso_fisico_kg,
              updated_at, is_deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Replication Start Function ────────────────────────────────────────────────

/**
 * Starts bidirectional GraphQL replication for all collections.
 *
 * Call this AFTER the database is initialized (after getDatabase() resolves).
 * Recommended call site: inside useEffect in the root App component,
 * after <DatabaseProvider> mounts and db is available.
 *
 * @param db - The RxDB database instance (from useDatabase() hook)
 * @returns void — replication runs as a background process
 *
 * @example
 * ```typescript
 * const db = useDatabase();
 *
 * useEffect(() => {
 *   startReplication(db);
 * }, [db]);
 * ```
 */
export interface ReplicationStates {
  oeeEvents: RxGraphQLReplicationState<IOeeEvent, GraphQLOeeEvent>;
  signatures: RxGraphQLReplicationState<ISignature, GraphQLSignature>;
  qualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  defectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  weightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  toasterLogs: RxGraphQLReplicationState<IToasterLog, GraphQLToasterLog>;
  mixingBatches: RxGraphQLReplicationState<IMixingBatch, GraphQLMixingBatch>;
  extractorChecks: RxGraphQLReplicationState<IExtractorCheck, GraphQLExtractorCheck>;
  vitaminKits: RxGraphQLReplicationState<IVitaminKit, GraphQLVitaminKit>;
  operators: RxGraphQLReplicationState<IOperator, GraphQLOperator>;
  productWeightStandards: RxGraphQLReplicationState<IProductWeightStandard, GraphQLProductWeightStandard>;
  shiftSessions: RxGraphQLReplicationState<IShiftSession, GraphQLShiftSession>;
  downtimeConciliations: RxGraphQLReplicationState<IDowntimeConciliation, GraphQLDowntimeConciliation>;
  plantConfigs: RxGraphQLReplicationState<IPlantConfig, GraphQLPlantConfig>;
  shiftSummaries: RxGraphQLReplicationState<IShiftSummary, GraphQLShiftSummary>;
  /** Resilient replication controller for OEE events (backoff, circuit breaker, DLQ). */
  resilientOeeController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for signatures (backoff + circuit breaker only). */
  resilientSignaturesController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for quality inspections (backoff + circuit breaker only). */
  resilientQualityInspectionsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for defect logs (backoff + circuit breaker only). */
  resilientDefectLogsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for weight logs (backoff + circuit breaker only). */
  resilientWeightLogsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for toaster logs (backoff + circuit breaker only). */
  resilientToasterLogsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for mixing batches (backoff + circuit breaker only). */
  resilientMixingBatchesController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for extractor checks (backoff + circuit breaker only). */
  resilientExtractorChecksController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for vitamin kits (backoff + circuit breaker only). */
  resilientVitaminKitsController?: { cleanup: () => void; getState: () => ResilientState };
}

export function startReplication(db: ChocolateIbarraDatabase): ReplicationStates {
  // ── OEE Events replication ─────────────────────────────────────────────────
  let replicationOeeEvents: RxGraphQLReplicationState<IOeeEvent, GraphQLOeeEvent>;
  let resilientOeeController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationOeeEvents = replicateGraphQL<IOeeEvent, GraphQLOeeEvent>({
      replicationIdentifier: 'oee-events-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.oee_events,
      pull: {
        queryBuilder: pullQueryBuilderOeeEvents,
        modifier: (doc: GraphQLOeeEvent) => ({ ...fromGraphQLOeeEvent(doc), _deleted: doc.deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderOeeEvents,
      },
      live: false, // WebSocket disabled for browser compatibility
      retryTime: 5000,
      autoStart: true,
    });

    // Wrap OEE replication with resilience layer (backoff, circuit breaker, DLQ)
    resilientOeeController = createResilientReplication(
      replicationOeeEvents,
      db,
      { url: getGraphQLUrl(), getHeaders },
      undefined,
      runDLQDiagnosis,
    );
  } catch (err) {
    console.warn('OeeEvents replication failed to initialise:', err);
    replicationOeeEvents = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Signatures replication ─────────────────────────────────────────────────
  let replicationSignatures: RxGraphQLReplicationState<ISignature, GraphQLSignature>;
  let resilientSignaturesController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationSignatures = replicateGraphQL<ISignature, GraphQLSignature>({
      replicationIdentifier: 'signatures-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.signatures,
      pull: {
        queryBuilder: pullQueryBuilderSignatures,
        modifier: (doc: GraphQLSignature) => ({ ...fromGraphQLSignature(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderSignatures,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientSignaturesController = createResilientReplication(
      replicationSignatures,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('Signatures replication failed to initialise:', err);
    replicationSignatures = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Quality Inspections replication ────────────────────────────────────────
  let replicationQualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  let resilientQualityInspectionsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationQualityInspections = replicateGraphQL<IQualityInspection, GraphQLQualityInspection>({
      replicationIdentifier: 'quality-inspections-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.quality_inspections,
      pull: {
        queryBuilder: pullQueryBuilderQualityInspections,
        modifier: (doc: GraphQLQualityInspection) => ({ ...fromGraphQLQualityInspection(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderQualityInspections,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientQualityInspectionsController = createResilientReplication(
      replicationQualityInspections,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('QualityInspections replication failed to initialise:', err);
    replicationQualityInspections = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Defect Logs replication ────────────────────────────────────────────────
  let replicationDefectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  let resilientDefectLogsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationDefectLogs = replicateGraphQL<IDefectLog, GraphQLDefectLog>({
      replicationIdentifier: 'defect-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.defect_logs,
      pull: {
        queryBuilder: pullQueryBuilderDefectLogs,
        modifier: (doc: GraphQLDefectLog) => ({ ...fromGraphQLDefectLog(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderDefectLogs,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientDefectLogsController = createResilientReplication(
      replicationDefectLogs,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('DefectLogs replication failed to initialise:', err);
    replicationDefectLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Weight Logs replication ────────────────────────────────────────────────
  let replicationWeightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  let resilientWeightLogsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationWeightLogs = replicateGraphQL<IWeightLog, GraphQLWeightLog>({
      replicationIdentifier: 'weight-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.weight_logs,
      pull: {
        queryBuilder: pullQueryBuilderWeightLogs,
        modifier: (doc: GraphQLWeightLog) => ({ ...fromGraphQLWeightLog(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderWeightLogs,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientWeightLogsController = createResilientReplication(
      replicationWeightLogs,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('WeightLogs replication failed to initialise:', err);
    replicationWeightLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Toaster Logs replication ───────────────────────────────────────────────
  let replicationToasterLogs: RxGraphQLReplicationState<IToasterLog, GraphQLToasterLog>;
  let resilientToasterLogsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationToasterLogs = replicateGraphQL<IToasterLog, GraphQLToasterLog>({
      replicationIdentifier: 'toaster-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.toaster_logs,
      pull: {
        queryBuilder: pullQueryBuilderToasterLogs,
        modifier: (doc: GraphQLToasterLog) => ({ ...fromGraphQLToasterLog(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderToasterLogs,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientToasterLogsController = createResilientReplication(
      replicationToasterLogs,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('ToasterLogs replication failed to initialise:', err);
    replicationToasterLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Mixing Batches replication ─────────────────────────────────────────────
  let replicationMixingBatches: RxGraphQLReplicationState<IMixingBatch, GraphQLMixingBatch>;
  let resilientMixingBatchesController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationMixingBatches = replicateGraphQL<IMixingBatch, GraphQLMixingBatch>({
      replicationIdentifier: 'mixing-batches-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.mixing_batches,
      pull: {
        queryBuilder: pullQueryBuilderMixingBatches,
        modifier: (doc: GraphQLMixingBatch) => ({ ...fromGraphQLMixingBatch(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderMixingBatches,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientMixingBatchesController = createResilientReplication(
      replicationMixingBatches,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('MixingBatches replication failed to initialise:', err);
    replicationMixingBatches = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Extractor Checks replication ───────────────────────────────────────────
  let replicationExtractorChecks: RxGraphQLReplicationState<IExtractorCheck, GraphQLExtractorCheck>;
  let resilientExtractorChecksController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationExtractorChecks = replicateGraphQL<IExtractorCheck, GraphQLExtractorCheck>({
      replicationIdentifier: 'extractor-checks-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.extractor_checks,
      pull: {
        queryBuilder: pullQueryBuilderExtractorChecks,
        modifier: (doc: GraphQLExtractorCheck) => ({ ...fromGraphQLExtractorCheck(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderExtractorChecks,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientExtractorChecksController = createResilientReplication(
      replicationExtractorChecks,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('ExtractorChecks replication failed to initialise:', err);
    replicationExtractorChecks = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Vitamin Kits replication ───────────────────────────────────────────────
  let replicationVitaminKits: RxGraphQLReplicationState<IVitaminKit, GraphQLVitaminKit>;
  let resilientVitaminKitsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationVitaminKits = replicateGraphQL<IVitaminKit, GraphQLVitaminKit>({
      replicationIdentifier: 'vitamin-kits-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.vitamin_kits,
      pull: {
        queryBuilder: pullQueryBuilderVitaminKits,
        modifier: (doc: GraphQLVitaminKit) => ({ ...fromGraphQLVitaminKit(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderVitaminKits,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientVitaminKitsController = createResilientReplication(
      replicationVitaminKits,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('VitaminKits replication failed to initialise:', err);
    replicationVitaminKits = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Operators replication (pull-only — reference data from Epicor) ──────────
  let replicationOperators: RxGraphQLReplicationState<IOperator, GraphQLOperator>;
  try {
    replicationOperators = replicateGraphQL<IOperator, GraphQLOperator>({
      replicationIdentifier: 'operators-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.operators,
      pull: {
        queryBuilder: pullQueryBuilderOperators,
        modifier: (doc: GraphQLOperator) => ({ ...fromGraphQLOperator(doc), _deleted: doc.is_deleted ?? false }),
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('Operators replication failed to initialise:', err);
    replicationOperators = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Product Weight Standards replication (pull-only) ────────────────────────
  let replicationProductWeightStandards: RxGraphQLReplicationState<IProductWeightStandard, GraphQLProductWeightStandard>;
  try {
    replicationProductWeightStandards = replicateGraphQL<IProductWeightStandard, GraphQLProductWeightStandard>({
      replicationIdentifier: 'product-weight-standards-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.product_weight_standards,
      pull: {
        queryBuilder: pullQueryBuilderProductWeightStandards,
        modifier: (doc: GraphQLProductWeightStandard) => ({ ...fromGraphQLProductWeightStandard(doc), _deleted: doc.is_deleted ?? false }),
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('ProductWeightStandards replication failed to initialise:', err);
    replicationProductWeightStandards = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Shift Sessions replication ──────────────────────────────────────────────
  let replicationShiftSessions: RxGraphQLReplicationState<IShiftSession, GraphQLShiftSession>;
  try {
    replicationShiftSessions = replicateGraphQL<IShiftSession, GraphQLShiftSession>({
      replicationIdentifier: 'shift-sessions-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.shift_sessions,
      pull: {
        queryBuilder: pullQueryBuilderShiftSessions,
        modifier: (doc: GraphQLShiftSession) => ({ ...fromGraphQLShiftSession(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderShiftSessions,
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('ShiftSessions replication failed to initialise:', err);
    replicationShiftSessions = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Downtime Conciliation replication ───────────────────────────────────────
  let replicationDowntimeConciliations: RxGraphQLReplicationState<IDowntimeConciliation, GraphQLDowntimeConciliation>;
  try {
    replicationDowntimeConciliations = replicateGraphQL<IDowntimeConciliation, GraphQLDowntimeConciliation>({
      replicationIdentifier: 'downtime-conciliation-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.downtime_conciliation,
      pull: {
        queryBuilder: pullQueryBuilderDowntimeConciliations,
        modifier: (doc: GraphQLDowntimeConciliation) => ({ ...fromGraphQLDowntimeConciliation(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderDowntimeConciliations,
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('DowntimeConciliation replication failed to initialise:', err);
    replicationDowntimeConciliations = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Plant Config replication ────────────────────────────────────────────────
  let replicationPlantConfigs: RxGraphQLReplicationState<IPlantConfig, GraphQLPlantConfig>;
  try {
    replicationPlantConfigs = replicateGraphQL<IPlantConfig, GraphQLPlantConfig>({
      replicationIdentifier: 'plant-config-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.plant_config,
      pull: {
        queryBuilder: pullQueryBuilderPlantConfigs,
        modifier: (doc: GraphQLPlantConfig) => ({ ...fromGraphQLPlantConfig(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderPlantConfigs,
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('PlantConfig replication failed to initialise:', err);
    replicationPlantConfigs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Shift Summary replication ───────────────────────────────────────────────
  let replicationShiftSummaries: RxGraphQLReplicationState<IShiftSummary, GraphQLShiftSummary>;
  try {
    replicationShiftSummaries = replicateGraphQL<IShiftSummary, GraphQLShiftSummary>({
      replicationIdentifier: 'shift-summary-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.shift_summary,
      pull: {
        queryBuilder: pullQueryBuilderShiftSummaries,
        modifier: (doc: GraphQLShiftSummary) => ({ ...fromGraphQLShiftSummary(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderShiftSummaries,
      },
      live: false,
      autoStart: true,
    });
  } catch (err) {
    console.warn('ShiftSummary replication failed to initialise:', err);
    replicationShiftSummaries = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  return {
    oeeEvents: replicationOeeEvents,
    signatures: replicationSignatures,
    qualityInspections: replicationQualityInspections,
    defectLogs: replicationDefectLogs,
    weightLogs: replicationWeightLogs,
    toasterLogs: replicationToasterLogs,
    mixingBatches: replicationMixingBatches,
    extractorChecks: replicationExtractorChecks,
    vitaminKits: replicationVitaminKits,
    operators: replicationOperators,
    productWeightStandards: replicationProductWeightStandards,
    shiftSessions: replicationShiftSessions,
    downtimeConciliations: replicationDowntimeConciliations,
    plantConfigs: replicationPlantConfigs,
    shiftSummaries: replicationShiftSummaries,
    resilientOeeController,
    resilientSignaturesController,
    resilientQualityInspectionsController,
    resilientDefectLogsController,
    resilientWeightLogsController,
    resilientToasterLogsController,
    resilientMixingBatchesController,
    resilientExtractorChecksController,
    resilientVitaminKitsController,
  };
}

// ─── Pull Query Builder (Operators — pull-only) ─────────────────────────────

function pullQueryBuilderOperators(checkpoint: GraphQLOperator | undefined, _limit: number) {
  return {
    query: `
      query PullOperators($lastCheckpoint: timestamptz!) {
        operators(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          full_name
          is_active
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Pull Query Builder (Shift Sessions — pull/push) ───────────────────────

function pullQueryBuilderShiftSessions(checkpoint: GraphQLShiftSession | undefined, _limit: number) {
  return {
    query: `
      query PullShiftSessions($lastCheckpoint: timestamptz!) {
        shift_sessions(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          machine_id
          operator_id
          shift_type
          status
          started_at
          ended_at
          planned_boxes
          product_code
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Pull Query Builder (Product Weight Standards — pull-only) ───────────────

function pullQueryBuilderProductWeightStandards(checkpoint: GraphQLProductWeightStandard | undefined, _limit: number) {
  return {
    query: `
      query PullProductWeightStandards($lastCheckpoint: timestamptz!) {
        product_weight_standards(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          sku
          name
          lower_limit
          upper_limit
          requires_tare
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Pull Query Builder (Quality Inspections) ────────────────────────────────

function pullQueryBuilderQualityInspections(checkpoint: GraphQLQualityInspection | undefined, _limit: number) {
  return {
    query: `
      query PullQualityInspections($lastCheckpoint: timestamptz!) {
        quality_inspections(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          machine_id
          inspector_id
          shift_type
          disposition
          notes
          data_source
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Quality Inspections Upsert) ───────────────────────

function pushMutationBuilderQualityInspections(docs: any[]) {
  const objects = docs.map(toGraphQLQualityInspection);
  return {
    query: `
      mutation UpsertInspections($objects: [quality_inspections_insert_input!]!) {
        insert_quality_inspections(
          objects: $objects,
          on_conflict: {
            constraint: quality_inspections_pkey,
            update_columns: [
              machine_id, inspector_id, shift_type, disposition,
              notes, data_source, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Defect Logs) ─────────────────────────────────────────

function pullQueryBuilderDefectLogs(checkpoint: GraphQLDefectLog | undefined, _limit: number) {
  return {
    query: `
      query PullDefectLogs($lastCheckpoint: bigint!) {
        defect_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          defect_type
          defect_code
          quantity
          severity
          notes
          registered_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Shift Sessions Upsert) ────────────────────────────

function pushMutationBuilderShiftSessions(docs: any[]) {
  const objects = docs.map(toGraphQLShiftSession);
  return {
    query: `
      mutation UpsertShiftSessions($objects: [shift_sessions_insert_input!]!) {
        insert_shift_sessions(
          objects: $objects,
          on_conflict: {
            constraint: shift_sessions_pkey,
            update_columns: [
              machine_id, operator_id, shift_type, status,
              started_at, ended_at, planned_boxes, product_code,
              updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Downtime Conciliation) ──────────────────────────────

function pullQueryBuilderDowntimeConciliation(checkpoint: GraphQLDowntimeConciliation | undefined, _limit: number) {
  return {
    query: `
      query PullDowntimeConciliation($lastCheckpoint: timestamptz!) {
        downtime_conciliation(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          oee_event_id
          shift_session_id
          machine_id
          reason_code
          duration_min
          diagnosed_code
          diagnosed_by
          diagnosed_at
          conciliated
          conciliated_code
          conciliated_macro
          conciliated_by_prod
          conciliated_by_mtto
          conciliated_at
          conciliation_notes
          status
          ot_sent
          ot_response
          ot_sent_at
          is_mtto
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Downtime Conciliation Upsert) ────────────────────

function pushMutationBuilderDowntimeConciliation(docs: any[]) {
  const objects = docs.map(toGraphQLDowntimeConciliation);
  return {
    query: `
      mutation UpsertDowntimeConciliation($objects: [downtime_conciliation_insert_input!]!) {
        insert_downtime_conciliation(
          objects: $objects,
          on_conflict: {
            constraint: downtime_conciliation_pkey,
            update_columns: [
              oee_event_id, shift_session_id, machine_id, reason_code,
              duration_min, diagnosed_code, diagnosed_by, diagnosed_at,
              conciliated, conciliated_code, conciliated_macro,
              conciliated_by_prod, conciliated_by_mtto, conciliated_at,
              conciliation_notes, status, ot_sent, ot_response, ot_sent_at,
              is_mtto, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Plant Config) ──────────────────────────────────────

function pullQueryBuilderPlantConfig(checkpoint: GraphQLPlantConfig | undefined, _limit: number) {
  return {
    query: `
      query PullPlantConfig($lastCheckpoint: timestamptz!) {
        plant_config(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          key
          value
          description
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Plant Config Upsert) ────────────────────────────

function pushMutationBuilderPlantConfig(docs: any[]) {
  const objects = docs.map(toGraphQLPlantConfig);
  return {
    query: `
      mutation UpsertPlantConfig($objects: [plant_config_insert_input!]!) {
        insert_plant_config(
          objects: $objects,
          on_conflict: {
            constraint: plant_config_pkey,
            update_columns: [
              value, description, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Shift Summary) ─────────────────────────────────────

function pullQueryBuilderShiftSummary(checkpoint: GraphQLShiftSummary | undefined, _limit: number) {
  return {
    query: `
      query PullShiftSummary($lastCheckpoint: timestamptz!) {
        shift_summary(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          shift_session_id
          total_planned_min
          total_downtime_min
          total_micro_stop_min
          total_mtto_min
          total_prod_min
          total_boxes
          total_rejects
          performance_pct
          has_pending_conciliation
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Shift Summary Upsert) ──────────────────────────

function pushMutationBuilderShiftSummary(docs: any[]) {
  const objects = docs.map(toGraphQLShiftSummary);
  return {
    query: `
      mutation UpsertShiftSummary($objects: [shift_summary_insert_input!]!) {
        insert_shift_summary(
          objects: $objects,
          on_conflict: {
            constraint: shift_summary_pkey,
            update_columns: [
              shift_session_id, total_planned_min, total_downtime_min,
              total_micro_stop_min, total_mtto_min, total_prod_min,
              total_boxes, total_rejects, performance_pct,
              has_pending_conciliation, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}