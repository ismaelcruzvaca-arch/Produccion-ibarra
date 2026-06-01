# Engram Knowledge Snapshot — produccion-ibarra

> Generado: 2026-05-31
> Propósito: Bootstrap rápido al cambiar de dispositivo. Contiene todo el contexto del proyecto.

---

## Stack

- **Framework**: Expo SDK 52 + expo-router 4 (file-based routing)
- **Platform**: React Native 0.76.9 / React 18.3.1 (web via react-native-web)
- **Language**: TypeScript 5.3 (strict mode)
- **State**: Zustand + RxDB
- **Backend**: Nhost (Hasura GraphQL + Auth + Storage)
- **Sync**: RxDB replication con pull/push queries GraphQL
- **Testing**: Jest + React Native Testing Library

---

## SDDs Completados (Archivados)

### 1. settings-screen (May 27)
- Admin panel completo con CRUD de catálogos (stop_reasons, lines, machines)
- Power BI deep-link, perfil de usuario, permisos por rol
- `useSettingsPermissions`: 3 roles (operator/supervisor/admin), 5 secciones
- `hasuraMutations.ts`: 9 funciones CRUD con updated_by
- ⏳ `quality_permissions.json` (519 líneas) **nunca aplicado** en Hasura

### 2. downtime-conciliation (May 29)
- 22 tareas, 30 tests, PASS WITH WARNINGS
- Clasificación micro-paros, conciliación OEE↔Mantenimiento, trigger OTs vía cmms-ibero

### 3. gateway-alerts (May 29)
- 18 archivos, Remote Schema para IoT Gateway
- ⏳ **AlertSnackbar nunca montado en UI** (warning del verify)
- ⏳ Remote Schema: depende de hardware IoT (Pi 5)

### 4. quality-trends (May 29)
- 8 tareas, 16 tests, gráficos de peso/defectos/calidad
- weight line chart, defect severity bar chart, quality % KPI

### 5. wo-lifecycle-integration (May 30-31)
- 16/16 tareas, 31 tests
- completed_at pipeline + badge lifecycle_phase en ConciliationScreen
- DTO roundtrip, sync builders, badge colors testeados

---

## Pendientes Clave

| Prioridad | Item | Detalle |
|-----------|------|---------|
| 🔴 Alta | `quality_permissions.json` | Aplicar en Hasura (track tables + RLS quality_inspections, defect_logs, weight_logs, product_weight_standards) |
| 🟡 Media | AlertSnackbar en UI | Montar en jerarquía (código ya existe) |
| 🟡 Media | Creación usuarios operadores | No tienen email corporativo → dummy emails o PIN |
| 🟡 Media | Mapa producto | Definir roles, pantallas, permisos formalmente |
| 🟢 Baja | Migración updated_by/updated_at | Tablas catálogo (stop_reasons, lines, machines) |
| 🟢 Baja | Códigos paro F-PD-21 | No coinciden papel vs DB, configurables desde Settings |
| ⏳ Bloqueado | Gateway IoT Remote Schema | Depende de hardware Pi 5 |
| ⏳ Bloqueado | Epicor BPMs | Pendiente respuestas de IT |

---

## Convenciones de Código

### Patrones
- **Arquitectura**: Atomic Design (atoms → molecules → organisms → templates → screens)
- **Data Layer**: Core types → RxDB schema → DTO mappers → sync builders
- **Hooks**: `src/ui/hooks/use{Feature}.ts` — lógica de negocio + datos
- **Screens**: `app/(tabs)/{feature}.tsx` — file-based routing expo-router
- **DTO Mappers**: `toGraphQL{Entity}` (push), `fromGraphQL{Entity}` (pull)
- **TIMESTAMPTZ → epoch ms**: `new Date(isoString).getTime()` / `new Date(epochMs).toISOString()`
- **BIGINT → string**: `.toString()` / `parseInt(str, 10)`

### Roles
- `operator`: Solo su línea (vía `_exists` subquery en RLS)
- `supervisor`: Full read/write, multi-línea
- `admin`: Full access + CRUD catálogos

### RxDB
- Schema version bump necesita migration strategy
- `IBaseDocument`: `id`, `client_updated_at`, `is_deleted` (NO tiene `device_id`)
- RxDB-only fields (`device_id`, `is_deleted`) no se envían a GraphQL

---

## Rutas Clave del Repo

```
src/core/types.ts             → Interfaces del dominio
src/data/schemas.ts           → RxDB schemas + migration strategies
src/data/database.ts          → Inicialización DB + migraciones
src/graphql/dto.ts            → DTO mappers (to/from GraphQL)
src/graphql/sync.ts           → Pull/push query builders
src/auth/useAuthStore.ts      → Auth state (user, role, fullName)
src/ui/hooks/useSettingsPermissions.ts → Permisos por rol
src/ui/components/organisms/settings/ → Componentes settings
src/ui/components/organisms/ConciliationScreen.tsx → Badge lifecycle_phase
hasura/quality_permissions.json → RLS calidad (pendiente aplicar)
hasura/rls_oee_events.json     → RLS OEE aplicado
migrations/                    → Migraciones SQL (formato sqitch-style)
```

---

## Cómo Recuperar Memoria en el Nuevo Dispositivo

```bash
# Opción 1: Importar desde el archivo exportado
engram import ./engram-export.json

# Opción 2: Si Engram Cloud está corriendo en el nuevo dispositivo
engram cloud enroll
engram sync --cloud --project produccion-ibarra
```

---

## Últimas Features Implementadas

### wo-lifecycle-integration (último SDD)
- `completed_at?: number` en `IWorkOrder` (types.ts:112)
- Schema workOrderSchema v2 (schemas.ts:79-128)
- `completed_at` en DTO mappers (dto.ts:157,182,208)
- `completed_at` en pull/push builders (sync.ts:206,241)
- Badge lifecycle_phase en ConciliationScreen (7 colores ISO 14224)
- 31 tests nuevos (3 archivos)
