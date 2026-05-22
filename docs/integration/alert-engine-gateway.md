# Documento de Integración — Frontend produccion-ibarra ←→ Alert Engine

**Estado**: PENDIENTE

---

## Endpoints GraphQL (vía Hasura Remote Schema)

Las tablas del gateway se exponen como Remote Schema en produccion-ibarra. Mismos queries que tablas locales.

### Listar reglas de alerta por planta

```graphql
query AlertRules($plantId: uuid!) {
  alert_rules(
    where: { plant_id: { _eq: $plantId }, scope: { _eq: "USER_DEFINED" } }
    order_by: { created_at: desc }
  ) {
    id, node_id, tipo_condicion, valor_umbral, canales,
    cooldown_minutos, last_alerted_at, enabled
  }
}
```

### Crear regla de silencio

```graphql
mutation CreateSilenceRule($plantId: uuid!, $nodeId: String!, $umbral: Int!, $canales: jsonb!) {
  insert_alert_rules_one(object: {
    plant_id: $plantId, node_id: $nodeId,
    scope: "USER_DEFINED", tipo_condicion: "SILENCE_TIMEOUT",
    valor_umbral: $umbral, canales: $canales,
    cooldown_minutos: 30, enabled: true
  }) { id }
}
```

### Catálogo de hardware (nodos + capacidades)

```graphql
query NodeCatalog($plantId: uuid!) {
  nodes(where: { machine: { line: { plant_id: { _eq: $plantId } } } }) {
    id, node_ident
    device_model {
      model_name
      model_capabilities {
        alert_capability { capability_key, description }
      }
    }
    machine { name, line { name } }
  }
}
```

### Historial de eventos

```graphql
query AlertEvents($plantId: uuid!, $limit: Int = 50) {
  alert_events(
    where: { plant_id: { _eq: $plantId } }
    order_by: { created_at: desc }, limit: $limit
  ) { id, node_id, tipo_evento, mensaje, detected_at, dispatched, dispatch_result }
}
```

---

## Pantallas sugeridas

| Pantalla | Queries | Descripción |
|---|---|---|
| Reglas activas | `alert_rules(plant_id)` + toggle enabled | Tabla con nodo, condición, umbral, canales, estado |
| Crear regla | `nodes` + `alert_capabilities` + mutation | Selector máquina → nodo → condición → umbral (minutos) → canales |
| Historial | `alert_events(plant_id)` | Timeline con filtros por nodo y rango de fechas |
| Estado motor | `alert_engine_health` | Última ejecución, reglas evaluadas vs alertas |

---

## RLS (ya configurado en el gateway)

| Tabla | Filtro automático |
|---|---|
| `alert_rules` | Solo reglas de `x-hasura-plant-id` |
| `alert_events` | Solo eventos de `x-hasura-plant-id` |
| `nodes` | Solo nodos de sus máquinas |

---

## Configuración necesaria en Nhost produccion-ibarra

1. Agregar Remote Schema apuntando al endpoint de Hasura de `ibarra-iot-gateway`
2. Forwardear `x-hasura-plant-id` del JWT existente
3. El gateway ya acepta el header y aplica RLS automáticamente

---

## Seed de prueba

```sql
INSERT INTO plants (name, code) VALUES ('Planta GDL Pruebas', 'GDL-TEST')
ON CONFLICT (code) DO NOTHING;

INSERT INTO user_plants (user_id, plant_id, role)
SELECT au.id, p.id, 'supervisor'
FROM auth.users au, plants p
WHERE au.email = 'supervisor@prueba.com' AND p.code = 'GDL-TEST';
```
