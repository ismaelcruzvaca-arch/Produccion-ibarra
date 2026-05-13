# Fase 2: Captura OEE — Documento de Diseño y Contexto

> **Proyecto**: Chocolate Ibarra Producción  
> **Formato base**: F-PD-21 (Cavemil 02)  
> **Fecha de diseño**: 2026-05-13  
> **Estado**: Aprobado para implementación  
> **Artefactos SDD**: Explore → Proposal → Specs → Design → Tasks ✅  

---

## 1. Contexto del Proyecto

| Capa | Tecnología | Detalle |
|------|-----------|---------|
| Framework | Expo SDK 52 + expo-router 4 | Web + Mobile (tablet industrial) |
| Offline-first | RxDB 15 + Dexie (IndexedDB) | Sin SQLite nativo |
| Sync | Nhost GraphQL/Hasura | Solo nativo; web=100% offline |
| State UI | Zustand `useUIStore` | Theme, filtros, sync status |
| Monitoreo | Sentry Error Boundary | Listo para activar con DSN |
| UI | react-native-paper | Touch targets ≥48dp para tablet industrial |

**Patrones arquitectónicos**:
- Repository (anti-corruption layer) — UI nunca toca RxDB directamente
- DTO mappers (camelCase ↔ snake_case) entre RxDB y GraphQL
- IBaseDocument: `{ id, client_updated_at, deleted }` para todas las colecciones

**Schema actual**:
- `assets`, `asset_types`, `work_orders`, `reports`
- `reports` es genérico con `data: { line_id, total_pieces, rejected_pieces, downtime_minutes }`

---

## 2. Regla Arquitectónica Cero

> **El proyecto es altamente cambiante. La UI debe estar completamente separada de la lógica de negocio. Los catálogos de datos NO deben estar "hardcodeados" en los componentes visuales.**

---

## 3. Decisiones de Diseño Clave

### 3.1 Coexistencia de colecciones
- `oee_events` = fuente de verdad cruda (eventos atómicos)
- `reports` = vista agregada (generada automáticamente al cerrar turno)
- **NO se elimina** el schema `reports` existente

### 3.2 Modelo de eventos atómicos
El operador registra **EVENTOS**, no totales:
- `shift_start` — Inicio de turno
- `shift_end` — Fin de turno
- `downtime_start` — Inicio de paro (con código de falla)
- `downtime_end` — Fin de paro
- `box_count` — Conteo de cajas buenas
- `reject_count` — Conteo de rechazos

**Ventaja**: La base de datos calcula los totales por hora automáticamente.

### 3.3 Sync con Nhost
- `oee_events` se replica a Nhost para backup
- **Configuración actual**: `live: false` (tabla NO existe en Hasura todavía)
- Trabajo 100% offline-first en esta fase
- Cuando el backend esté listo, cambiar a `live: true`

### 3.4 Máquina y Turno
- Máquina seleccionada **manualmente** al inicio de turno
- Turnos definidos en catálogo (1: 6-14, 2: 14-22, 3: 22-6)

### 3.5 Paros abiertos
- **BLOQUEO ESTRUCTO** de UI al intentar `shift_end` con `downtime_start` sin `downtime_end`
- El operador DEBE cerrar el paro o asignarle una causa antes de finalizar jornada
- **NO hay auto-close**

### 3.6 Corrección retroactiva
- Soft-delete del evento mal registrado
- Creación de evento nuevo con timestamp retroactivo
- Indicador visual en UI de que el evento fue editado/retroactivo

### 3.7 Fallback PPM
- Si el producto no tiene `theoretical_ppm` configurado, usar **1.0** como fallback
- Mostrar indicador visual **⚠️** en la UI del OEE Calculator cuando se usa el valor por defecto

---

## 4. Estructura de Datos (RxDB)

### 4.1 Schema `oee_events`

```typescript
export type OeeEventType = 
  | 'shift_start' 
  | 'shift_end' 
  | 'downtime_start' 
  | 'downtime_end' 
  | 'box_count' 
  | 'reject_count';

export interface IOeeEvent {
  id: string;
  updated_at: number;        // Nuevo contrato (no client_updated_at)
  deleted: boolean;
  
  // Contexto
  line_id: string;
  machine_id: string;
  operator_id?: string;
  shift_id: string;
  
  // Evento atómico
  event_type: OeeEventType;
  timestamp: number;         // Epoch ms del evento
  
  // Datos del evento
  reason_code?: string;      // Código de paro (FMP, AT, FC, etc.)
  quantity?: number;         // Cajas/rechazos
  planned_boxes?: number;    // Cajas planeadas (shift_start)
  notes?: string;
  
  // Retroactivo
  is_retroactive?: boolean;  // Indicador visual
  related_event_id?: string; // ID del downtime_start cuando es downtime_end
}
```

### 4.2 Índices obligatorios

| Índice | Justificación |
|--------|---------------|
| `timestamp` | Ordenamiento cronológico de eventos |
| `[line_id, timestamp]` | Filtrar eventos por máquina en rango de tiempo |
| `[shift_id, timestamp]` | Filtrar eventos por turno en rango de tiempo |

**Por qué**: Un turno con 500+ eventos haría full collection scan sin índices compuestos en Dexie/IndexedDB.

### 4.3 Schema RxDB

```typescript
export const oeeEventSchema: RxJsonSchema<IOeeEvent> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'updated_at', 'deleted', 'line_id', 'machine_id', 'shift_id', 'event_type', 'timestamp'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    updated_at:       { type: 'number' },
    deleted:          { type: 'boolean' },
    line_id:          { type: 'string' },
    machine_id:       { type: 'string' },
    operator_id:      { type: 'string' },
    shift_id:         { type: 'string' },
    event_type:       { type: 'string', enum: ['shift_start','shift_end','downtime_start','downtime_end','box_count','reject_count'] },
    timestamp:        { type: 'number' },
    reason_code:      { type: 'string' },
    quantity:         { type: 'number' },
    planned_boxes:    { type: 'number' },
    notes:            { type: 'string' },
    is_retroactive:   { type: 'boolean' },
    related_event_id: { type: 'string' },
  },
  indexes: ['timestamp', ['line_id', 'timestamp'], ['shift_id', 'timestamp']],
};
```

### 4.4 Registro en Database

```typescript
// src/data/database.ts
await db.addCollections({
  assets: { schema: assetSchema },
  asset_types: { schema: assetTypeSchema },
  work_orders: { schema: workOrderSchema },
  reports: { schema: reportSchema },
  oee_events: { schema: oeeEventSchema },  // NUEVO
});
```

---

## 5. Catálogos (src/config/catalogs.ts)

### 5.1 Motivos de Paro — F-PD-21

```typescript
export type ParoCategory = 'produccion' | 'mantenimiento' | 'calidad' | 'seguridad';
export type ParoMacro = 'PROD' | 'MTTO';

export interface ParoReason {
  code: string;
  label: string;
  category: ParoCategory;
  macro: ParoMacro;
  stopsLine: boolean;
}

export const PARO_REASONS: readonly ParoReason[] = [
  // ── Producción (PROD) ──
  { code: 'FMP', label: 'Falta materia prima',       category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'AT',  label: 'Arranque de turno',          category: 'produccion', macro: 'PROD', stopsLine: false },
  { code: 'FME', label: 'Falta material empaque',    category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'AO',  label: 'Ajuste de operación',        category: 'produccion', macro: 'PROD', stopsLine: false },
  { code: 'CP',  label: 'Cambio de presentación',    category: 'produccion', macro: 'PROD', stopsLine: true  },
  // ── Mantenimiento (MTTO) ──
  { code: 'FC',  label: 'Falla de Cavemil',           category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'FS',  label: 'Falla de Servicios',         category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
] as const;

export const PARO_BY_CODE: Record<string, ParoReason> = Object.fromEntries(
  PARO_REASONS.map((r) => [r.code, r]),
);

export const PARO_BY_MACRO: Record<string, ParoReason[]> = Object.groupBy(
  PARO_REASONS,
  (r: ParoReason) => r.macro,
);
```

### 5.2 Turnos

```typescript
export interface Turno {
  id: string;
  label: string;
  startHour: number; // 0-23
  endHour: number;
}

export const TURNOS: readonly Turno[] = [
  { id: '1', label: 'Turno 1 (06-14)', startHour: 6,  endHour: 14 },
  { id: '2', label: 'Turno 2 (14-22)', startHour: 14, endHour: 22 },
  { id: '3', label: 'Turno 3 (22-06)', startHour: 22, endHour: 6  },
] as const;

export function getCurrentTurno(): Turno { ... }
```

### 5.3 Productos (simula Epicor)

```typescript
export interface Producto {
  id: string;
  code: string;
  name: string;
  theoreticalPpm: number; // Cajas por minuto teórico
}

export const PRODUCTOS: readonly Producto[] = [
  { id: '1', code: 'CHOC-500', name: 'Chocolate 500g', theoreticalPpm: 2.5 },
  { id: '2', code: 'CHOC-250', name: 'Chocolate 250g', theoreticalPpm: 3.0 },
  // ...
] as const;

export const DEFAULT_PPM = 1.0;
```

---

## 6. Motor de Cálculo (OEE Calculator)

### 6.1 Algoritmo puro

```typescript
// src/core/oeeCalculator.ts
export interface OeeMetrics {
  disponibilidad: number; // 0-100%
  rendimiento: number;    // 0-100%
  calidad: number;        // 0-100%
  oee: number;            // 0-100%
  
  // Detalle
  tiempoPlanificadoMin: number;
  tiempoParoProdMin: number;
  tiempoParoMttoMin: number;
  tiempoOperandoMin: number;
  totalCajas: number;
  totalRechazos: number;
  cajasBuenas: number;
  ppmUtilizado: number;   // theoreticalPpm real usado
  usandoFallbackPpm: boolean; // true si es DEFAULT_PPM
}

export function computeOee(
  events: IOeeEvent[],
  productoPpm: number
): OeeMetrics {
  // 1. Filtrar eventos del turno (ordenados por timestamp)
  // 2. Calcular tiempo planificado: shift_end - shift_start
  // 3. Calcular paros: suma de (downtime_end - downtime_start) por macro
  // 4. Disponibilidad = (tiempoPlanif - paroTotal) / tiempoPlanif
  // 5. Rendimiento = (totalCajas / tiempoOperandoMin) / productoPpm
  // 6. Calidad = (totalCajas - rechazos) / totalCajas
  // 7. OEE = Disponibilidad × Rendimiento × Calidad
}
```

### 6.2 Hook ligero (sin cuellos de botella)

```typescript
// src/ui/hooks/useOeeCalculator.ts
export function useOeeCalculator(shiftId: string, machineId: string) {
  const events = useOeeEventsRepository(); // Observable de eventos
  
  const metrics = useMemo(() => {
    const shiftEvents = events.filter(/* por shiftId y machineId */);
    const producto = detectProducto(shiftEvents); // Del shift_start
    const ppm = producto?.theoreticalPpm ?? DEFAULT_PPM;
    return computeOee(shiftEvents, ppm);
  }, [events, shiftId, machineId]);
  
  return {
    metrics,
    isLoading: events.length === 0,
    usingFallback: metrics.usandoFallbackPpm,
  };
}
```

**Por qué useMemo**: Evita recalcular OEE en cada render si los eventos no cambiaron.

---

## 7. Jerarquía de Componentes UI (Fat Finger)

### 7.1 Dashboard Principal (OeeDashboard)

```
┌──────────────────────────────────────────────────────┐
│  🟢 REGISTRAR PRODUCCIÓN                            │
│  Conteo de cajas buenas del turno actual             │
│  [ + ]  42  [ - ]                                   │
│  ────────────────────                               │
│  Turno 2 · Cavemil 03 · 14:00-22:00                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  🔴 REGISTRAR PARO                                  │
│  > Producción: FMP · AT · FME · AO · CP             │
│  > Mantenimiento: FC · FS                            │
│  (Selector de motivo, luego registra downtime_start)  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  🟡 FIN DE PARO                                     │
│  Cierra el paro activo. Registra downtime_end.       │
│  Paro activo: FC (Falla Cavemil) · 00:23:17         │
└──────────────────────────────────────────────────────┘
```

**Principios**:
- Touch targets ≥56dp (tablet industrial con guantes)
- Catálogos cargados desde `catalogs.ts` (NO hardcodeados)
- Tarjeta amarilla muestra temporizador del paro activo
- Sin formularios tipo Excel ni tablas

### 7.2 Flujo de datos

```
OeeDashboard.tsx
├── consume: useOeeCalculator() → métricas OEE
├── consume: useOeeEventsRepository() → eventos
├── consume: catalogs.ts → motivos de paro, turnos
│
├── Renderiza:
│   ├── ActionCard (🟢 Registrar Producción)
│   │   └── onPress → repository.createEvent({ event_type: 'box_count', quantity })
│   ├── ActionCard (🔴 Registrar Paro)
│   │   └── onPress → StopReasonModal → repository.createEvent({ event_type: 'downtime_start', reason_code })
│   └── ActionCard (🟡 Fin de Paro)
│       └── onPress → ConfirmationModal → repository.createEvent({ event_type: 'downtime_end', related_event_id })
│
├── Bloqueos:
│   └── ShiftEndBlocker (si hay paro abierto)
│
└── Indicadores:
    ├── FallbackPpmWarning (⚠️ si theoreticalPpm = DEFAULT)
    └── RetroactiveEventBadge (si evento.is_retroactive)
```

---

## 8. Repository (useOeeEventsRepository)

```typescript
export interface OeeEventsRepository {
  docs$: Observable<RxDocument<IOeeEvent>[]>;
  createEvent: (event: Omit<IOeeEvent, 'id' | 'updated_at' | 'deleted'>) => Promise<RxDocument<IOeeEvent>>;
  update: (id: string, patch: Partial<Omit<IOeeEvent, 'id'>>) => Promise<RxDocument<IOeeEvent> | null>;
  remove: (id: string) => Promise<void>; // Soft-delete
  findById: (id: string) => Promise<RxDocument<IOeeEvent> | null>;
  findByShift: (shiftId: string) => Promise<RxDocument<IOeeEvent>[]>;
  findActiveDowntime: (machineId: string) => Promise<RxDocument<IOeeEvent> | null>;
}
```

---

## 9. Checklist de Implementación

**Total: 20 tareas | ~23.25 horas (~3 días efectivos)**

### Wave 1 — BD/Schema Primero (~3h)
- [ ] **1.1** Crear `src/config/catalogs.ts` — Catálogos type-safe (paros, turnos, productos)
- [ ] **1.2** Extender `src/core/types.ts` — `IOeeEvent`, `OeeEventType`, tipos de catálogo
- [ ] **1.3** Extender `src/data/schemas.ts` — `oeeEventSchema` con índices compuestos
- [ ] **1.4** Extender `src/data/database.ts` — Registrar colección `oee_events`

### Wave 2 — Lógica de Negocio (~9.5h)
- [ ] **2.1** Crear `src/repositories/useOeeEventsRepository.ts` — CRUD + observable
- [ ] **2.2** Extender `src/graphql/dto.ts` — Mappers `toGraphQLOeeEvent` / `fromGraphQLOeeEvent`
- [ ] **2.3** Preparar `src/graphql/sync.ts` — Sync de `oee_events` con `live: false`
- [ ] **2.4** Crear `src/core/oeeCalculator.ts` — Función pura `computeOee(events[])`
- [ ] **2.5** Crear `src/ui/hooks/useOeeCalculator.ts` — Hook ligero con `useMemo`
- [ ] **2.6** Crear `src/core/shiftReportGenerator.ts` — Generar `IReport` al `shift_end`
- [ ] **2.7** Implementar fallback PPM 1.0 + warning visual

### Wave 3 — UI Fat Finger (~7h)
- [ ] **3.1** Crear `app/(tabs)/oee.tsx` — Nueva pantalla principal OEE
- [ ] **3.2** Crear `src/ui/components/OeeDashboard.tsx` — Dashboard con 3 botones gigantes
- [ ] **3.3** Crear modal de selección de código de paro — Selector categorizado PROD/MTTO
- [ ] **3.4** Crear modal de confirmación de evento — Antes de registrar paro/fin de paro
- [ ] **3.5** Crear alerta de bloqueo de turno — Cuando hay paro abierto en `shift_end`
- [ ] **3.6** Actualizar `app/(tabs)/_layout.tsx` — Agregar tab OEE, eliminar tab Reports viejo

### Wave 4 — Testing (~4h)
- [ ] **4.1** Tests unitarios de `computeOee` — Edge cases: paro abierto, ppm inválido, turno vacío
- [ ] **4.2** Tests unitarios de repository — Mock RxDB, CRUD, soft-delete
- [ ] **4.3** Test de integración de report generator — Cierre de turno genera report correcto

---

## 10. Acceptance Criteria

| ID | Escenario | Resultado Esperado |
|---|---|---|
| AC-1 | Operador intenta cerrar turno con `downtime_start` sin `downtime_end` | Sistema bloquea UI y muestra alerta exigiendo cierre o causa |
| AC-2 | Registro de piezas producidas | Rendimiento usa `theoretical_ppm` del producto activo; si no existe, fallback 1.0 con ⚠️ |
| AC-3 | Operador olvida registrar paro y lo hace retroactivamente | Soft-delete del evento mal + evento nuevo con `is_retroactive=true` e indicador visual |

---

## 11. Archivos Afectados

### Nuevos (7)
- `src/config/catalogs.ts`
- `src/repositories/useOeeEventsRepository.ts`
- `src/core/oeeCalculator.ts`
- `src/core/shiftReportGenerator.ts`
- `src/ui/hooks/useOeeCalculator.ts`
- `src/ui/components/OeeDashboard.tsx`
- `app/(tabs)/oee.tsx`

### Modificados (6)
- `src/core/types.ts`
- `src/data/schemas.ts`
- `src/data/database.ts`
- `src/graphql/dto.ts`
- `src/graphql/sync.ts`
- `app/(tabs)/_layout.tsx`

### Eliminados (1)
- `app/(tabs)/reports.tsx` (reemplazado por `oee.tsx`)

---

## 12. Notas para el Siguiente Desarrollador / Sesión

1. **Empezar por Wave 1** (BD/Schema). Sin schema no compila nada downstream.
2. **Sync Nhost**: La tabla `oee_events` NO existe en Hasura. Mantener `live: false` hasta que backend esté listo.
3. **Fallback PPM**: Siempre verificar `usandoFallbackPpm` en UI para mostrar ⚠️.
4. **Índices**: Los índices compuestos `[line_id, timestamp]` y `[shift_id, timestamp]` son críticos para performance.
5. **UI Fat Finger**: Touch targets mínimo 56dp. Nada de tablas tipo Excel.
6. **Catálogos**: SIEMPRE importar desde `src/config/catalogs.ts`. NUNCA hardcodear en componentes.

---

*Documento generado automáticamente como respaldo de memoria. Última actualización: 2026-05-13.*
