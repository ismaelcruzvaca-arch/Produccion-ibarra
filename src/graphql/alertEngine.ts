/**
 * GraphQL queries and mutations for the IoT Gateway Alert Engine (Remote Schema).
 *
 * All queries target the remote gateway Hasura via Nhost Remote Schema.
 * Data is live — no RxDB sync.
 *
 * Pattern: Named query constants
 * Why:
 * - Consistent with the existing `sync.ts` approach (raw GraphQL strings).
 * - `nhost.graphql.request()` accepts plain strings — no Apollo/gql tag needed.
 * - Named exports make tree-shaking and import tracking straightforward.
 *
 * @see `docs/integration/alert-engine-gateway.md` for the canonical query forms.
 */

// ─── Alert Rules ────────────────────────────────────────────────────────────────

/**
 * List alert rules for a plant, USER_DEFINED scope only, newest first.
 */
export const ALERT_RULES = `
  query AlertRules($plantId: uuid!) {
    alert_rules(
      where: { plant_id: { _eq: $plantId }, scope: { _eq: "USER_DEFINED" } }
      order_by: { created_at: desc }
    ) {
      id
      node_id
      plant_id
      scope
      tipo_condicion
      valor_umbral
      canales
      cooldown_minutos
      last_alerted_at
      enabled
      created_at
    }
  }
`;

// ─── Node Catalog ───────────────────────────────────────────────────────────────

/**
 * All nodes (sensors) with their machine, line, device model, and alert capabilities.
 * Used by the cascading pickers in the rule editor.
 */
export const NODE_CATALOG = `
  query NodeCatalog($plantId: uuid!) {
    nodes(where: { machine: { line: { plant_id: { _eq: $plantId } } } }) {
      id
      node_ident
      device_model {
        model_name
        model_capabilities {
          alert_capability {
            capability_key
            description
          }
        }
      }
      machine {
        name
        line {
          name
        }
      }
    }
  }
`;

// ─── Alert Events ───────────────────────────────────────────────────────────────

/**
 * Paginated alert events with optional filters.
 * Default: newest first, limit 20.
 */
export const ALERT_EVENTS = `
  query AlertEvents(
    $plantId: uuid!
    $limit: Int = 20
    $offset: Int = 0
    $nodeId: uuid
    $dateFrom: timestamptz
    $dateTo: timestamptz
    $tipoEvento: String
  ) {
    alert_events(
      where: {
        plant_id: { _eq: $plantId }
        node_id: { _eq: $nodeId }
        detected_at: { _gte: $dateFrom, _lte: $dateTo }
        tipo_evento: { _eq: $tipoEvento }
      }
      order_by: { detected_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      node_id
      plant_id
      tipo_evento
      mensaje
      detected_at
      acknowledged
      dispatched
      dispatch_result
    }
  }
`;

// ─── Alert Events Aggregate (for badge count) ───────────────────────────────────

/**
 * Count of unacknowledged events for the current plant, optionally scoped
 * to a specific alert engine node (IoT sensor/gateway).
 * Used by the tab badge and snackbar logic.
 *
 * When $nodeId is provided, only events for that specific node are counted,
 * enabling operator-scoped alert badges per machine (F-AC-43 scope).
 */
export const ALERT_EVENTS_AGGREGATE = `
  query AlertEventsAggregate($plantId: uuid!, $nodeId: uuid) {
    alert_events_aggregate(
      where: {
        plant_id: { _eq: $plantId },
        acknowledged: { _eq: false },
        node_id: { _eq: $nodeId }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

// ─── Alert Engine Health ────────────────────────────────────────────────────────

/**
 * Latest health record for the alert engine.
 * No plant_id filter — returns the latest record (gateway-scoped via header).
 */
export const ALERT_ENGINE_HEALTH = `
  query AlertEngineHealth {
    alert_engine_health(limit: 1, order_by: { last_evaluation_at: desc }) {
      last_evaluation_at
      rules_evaluated
      alerts_triggered
      status
    }
  }
`;

// ─── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Toggle a rule's enabled state.
 */
export const TOGGLE_ALERT_RULE = `
  mutation ToggleAlertRule($id: uuid!, $enabled: Boolean!) {
    update_alert_rules(
      where: { id: { _eq: $id } }
      _set: { enabled: $enabled }
    ) {
      affected_rows
    }
  }
`;

/**
 * Delete an alert rule by ID.
 */
export const DELETE_ALERT_RULE = `
  mutation DeleteAlertRule($id: uuid!) {
    delete_alert_rules(where: { id: { _eq: $id } }) {
      affected_rows
    }
  }
`;

/**
 * Upsert an alert rule — insert if no id, update if id provided.
 * The caller passes the full object; Hasura handles insert vs update
 * via on_conflict or by_pk depending on whether id is present.
 */
export const UPSERT_ALERT_RULE = `
  mutation UpsertAlertRule($objects: [alert_rules_insert_input!]!) {
    insert_alert_rules(
      objects: $objects
      on_conflict: {
        constraint: alert_rules_pkey
        update_columns: [
          node_id
          tipo_condicion
          valor_umbral
          canales
          cooldown_minutos
          enabled
        ]
      }
    ) {
      returning {
        id
        node_id
        plant_id
        scope
        tipo_condicion
        valor_umbral
        canales
        cooldown_minutos
        last_alerted_at
        enabled
        created_at
      }
    }
  }
`;

/**
 * Acknowledge an alert event (mark as acknowledged).
 */
export const ACKNOWLEDGE_EVENT = `
  mutation AcknowledgeEvent($id: uuid!) {
    update_alert_events(
      where: { id: { _eq: $id } }
      _set: { acknowledged: true }
    ) {
      affected_rows
    }
  }
`;
