# ISA-95 / MESA Boundaries — Chocolate Ibarra Ecosystem

> **Documento**: Arquitectura de Sistemas — Límites Funcionales según ISA-95 y MESA 11
> **Fecha**: 2026-05-29
> **Versión**: 1.0
> **Autor**: SDD Explore — Deep Research

---

## Índice

1. [ISA-95 Context: The Four Levels](#1-isa-95-context-the-four-levels)
2. [System Inventory](#2-system-inventory)
3. [A. Feature-to-ISA-95 Mapping](#a-feature-to-isa-95-mapping)
4. [B. MESA 11 Gap Analysis](#b-mesa-11-gap-analysis)
5. [C. Clear System Boundaries](#c-clear-system-boundaries)
6. [D. Integration Points](#d-integration-points)
7. [E. Architecture Decision Records (Implicit)](#e-architecture-decision-records-implicit)
8. [F. Recommendations](#f-recommendations)

---

## 1. ISA-95 Context: The Four Levels

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 4 (Business Planning & Logistics)                    │
│  ERP: EPICOR                                                │
│  • Production planning & scheduling                          │
│  • Supply chain management                                   │
│  • Finance & accounting                                      │
│  • HR & payroll                                              │
│  • Material requirements (MRP)                               │
│  • Order management                                          │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 3 (Manufacturing Operations Management) — MES/MOM    │
│  produccion-ibarra (our app) + cmms-ibero + (future LIMS)  │
│  • Production ops: OEE capture, shift mgmt, conciliation    │
│  • Maintenance ops: Work orders, PM, CBM, asset mgmt        │
│  • Quality ops: Inspections, defect logs, weight checks     │
│  • Inventory ops: Material tracking (partial, via tags)     │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 2 (Control / Supervisory)                            │
│  ibarra-iot-gateway + PLCs + SCADA                          │
│  • Real-time machine monitoring (Modbus)                    │
│  • Vision inspection (GEMA-Vision cameras)                  │
│  • Sensor data collection (NORVI nodes, LoRaWAN)            │
│  • Setpoints & recipes (future)                             │
├─────────────────────────────────────────────────────────────┤
│  LEVELS 0-1 (Physical Process / Sensing)                    │
│  PLCs, sensors, actuators, motors, conveyors                │
│  • Physical production equipment                            │
│  • Inductive sensors (pulse counting)                       │
│  • Cameras, strobes                                         │
└─────────────────────────────────────────────────────────────┘
```

### ISA-95 Part 3: Manufacturing Operations Management (4 Categories)

| Category | Function | Our Coverage |
|----------|----------|-------------|
| **Production** | 1. Production Resource Mgmt | Partial |
| | 2. Production Dispatching | No (Epicor) |
| | 3. Production Execution | Full (OEE capture) |
| | 4. Production Data Collection | Full |
| | 5. Production Tracking | Full |
| | 6. Production Performance Analysis | Partial |
| **Maintenance** | 1. Maintenance Resource Mgmt | cmms-ibero |
| | 2. Maintenance Dispatching | cmms-ibero |
| | 3. Maintenance Execution | cmms-ibero |
| | 4. Maintenance Data Collection | Partial (conciliation bridge) |
| | 5. Maintenance Tracking | cmms-ibero |
| | 6. Maintenance Performance Analysis | Partial |
| **Quality** | 1. Quality Resource Mgmt | No |
| | 2. Quality Dispatching | No |
| | 3. Quality Execution | Full (inspections) |
| | 4. Quality Data Collection | Full |
| | 5. Quality Tracking | Partial |
| | 6. Quality Performance Analysis | No |
| **Inventory** | 1. Material Resource Mgmt | No |
| | 2. Material Dispatching | No |
| | 3. Material Execution | No |
| | 4. Material Data Collection | Partial |
| | 5. Material Tracking | No (future raw_feed tags) |
| | 6. Material Performance Analysis | No |

---

## 2. System Inventory

### 2.1 produccion-ibarra (Our App)
- **Tech**: React Native (Expo) + RxDB offline-first + Hasura/Nhost (PostgreSQL)
- **Role**: Production Operations Management — operator-facing MES terminal
- **Tabs**: Inicio (Dashboard) → OEE (capture) → Calidad → Turnos → Alertas → Ajustes

**All RxDB Collections (16 total):**

| Collection | RxDB Sync | Purpose | ISA-95 Function |
|------------|-----------|---------|-----------------|
| `oee_events` | Bi-dir | Atomic OEE events (shift start/end, downtime start/end, box count) | Prod Execution + Data Collection |
| `shift_sessions` | Bi-dir | Shift lifecycle (active/closed), operator-machine assignment | Prod Execution |
| `shift_summary` | Bi-dir | Cached aggregates per shift (downtime, micro-stops, boxes) | Prod Performance Analysis |
| `quality_inspections` | Bi-dir | Quality inspection header (disposition, shift, data source) | Quality Execution |
| `defect_logs` | Bi-dir | 1:N child of inspections (defect type, severity) | Quality Data Collection |
| `weight_logs` | Bi-dir | 1:N child of inspections (measured weight samples) | Quality Data Collection |
| `downtime_conciliation` | Bi-dir | Bridge: Production downtime → Maintenance OT trigger | Prod → Maint Bridge |
| `plant_config` | Bi-dir | Key-value plant parameters (e.g. micro_stop_threshold) | Config |
| `operators` | Pull-only | Reference: operators from Epicor payroll | Resource Mgmt |
| `product_weight_standards` | Pull-only | SKU weight limits for quality validation | Quality Resource Mgmt |
| `reports` | Bi-dir | Legacy production reports | Prod Performance Analysis |
| `assets` | Bi-dir | Equipment master (name, type, status, warranty) | Maintenance Resource Mgmt |
| `asset_types` | Bi-dir | Asset type catalog | Maintenance Resource Mgmt |
| `work_orders` | Bi-dir | Simple WO tracking (for local display) | Maintenance Execution |
| `sync_errors` | Local only | Dead letter queue for failed sync events | Sync Resilience |

**All Screens (Routes):**

| Route | Screen | Features |
|-------|--------|----------|
| `index.tsx` | Dashboard | KPIs (total piezas, calidad%, tiempo paro), bar chart, reports list, LiveOEE summary |
| `oee.tsx` | OEE Capture | Shift start/end, downtime start/end with reason, box/reject count, numpad, stop reason modal, confirm modal, shift blocker |
| `quality/capture.tsx` | Quality Capture | Inspector, shift type, SKU selector, disposition (liberado/rechazado/reproceso), weight logs, defect logs |
| `quality/index.tsx` | Quality List | Reactive list of inspections filtered by machine |
| `quality/[id].tsx` | Quality Detail | Read-only inspection detail with defect/weight children |
| `shifts/index.tsx` | Shift List | Active shift banner + closed shifts list |
| `shifts/setup.tsx` | Shift Setup | Operator, shift_type, planned_boxes, product_code |
| `shifts/[id].tsx` | Shift Detail | Session info, OEE metrics, quality inspections |
| `supervisor.tsx` | Alertas (DLQ) | Dead letter queue management: discard/retry sync errors |
| `settings.tsx` | Settings | Profile, Power BI, Plant Config, Catalogs (admin), System info |

### 2.2 cmms-ibero (CMMS — Maintenance)
- **Tech**: React + Vite + MUI frontend, Supabase (PostgreSQL + Edge Functions Deno)
- **Role**: Maintenance Management (ISO 14224)

**Schema (PostgreSQL):**
- `work_orders` — ISO 14224 aligned: lifecycle_phase ENUM (WAPPR→APPROVED→INPRG→COMP→CLOSED), 8 timestamps, 4 failure taxonomy codes, 3 operational context fields, 3 structured notes
- `assets` — Equipment master with equipment_id
- `user_profiles` — RBAC: ADMIN/PLANNER/TECHNICIAN/STOREKEEPER
- `audit_logs` — Immutable audit trail (generic trigger)
- `job_plans`, `job_plan_tasks`, `job_plan_materials` — PM/CBM templates
- `pm_schedules` — Time/meter-driven preventive schedules
- `meters`, `measure_points`, `meter_readings` — Condition monitoring
- `work_order_task_snapshots`, `work_order_material_snapshots` — Frozen copies
- `epicor_sync_queue` — Shared outbox with produccion-ibarra (SHIFT_CLOSED, QUALITY_DISPOSITION, OEE_MTTO_TRIGGER)

**Edge Functions:**
- `oee-trigger` (Deno): Accepts `{ equipment_id, sintoma }` from produccion-ibarra → creates corrective WO
- `epicor-webhook` (Deno): Accepts material receipt from Epicor BPM → records receipt, unblocks WO

**Specs (13 total):**
`auth-rbac`, `competency-engine`, `competency-evidence`, `competency-gate`, `job-plan-copy`, `job-plan-hierarchy`, `mechanic-work-order-execution`, `mechanic-work-order-list`, `oee-webhook`, `pm-engine-automata`, `preventive-condition-core`, `work-order-database`, `work-order-snapshot`

### 2.3 Epicor (ERP)
- **Role**: Business planning, production scheduling, supply chain, finance, inventory
- **Assumed capabilities**: MRP, production orders, BOM, routings, purchasing, AR/AP, GL, payroll

### 2.4 ibarra-iot-gateway (IoT)
- **Tech**: C++ on Raspberry Pi 5, Modbus RTU bridge, GEMA-Vision (RV1106 cameras), NORVI ESP32 (LoRaWAN)
- **Role**: Level 2 — Real-time machine data & vision inspection
- **Key components**: Modbus bridge to PLCs, vision pipeline for quality, MQTT telemetry, edge inference (LPRNet OCR)
- **Data flow**: Sensor pulses → LoRaWAN → Gateway → MQTT → Hasura (via webhook/ingress) → RxDB

---

## 3. A. Feature-to-ISA-95 Mapping

### Production Operations

| Feature | File/Table | What it does | ISA-95 Function | Completeness |
|---------|-----------|-------------|-----------------|--------------|
| Shift Session (start/end) | `shift_sessions`, `oee_events(shift_start/end)` | Tracks operator-machine assignment & shift lifecycle | 3.0 Prod Resource Mgmt | **Full** — operator, machine, shift_type, timing |
| Shift Setup (planned_boxes) | `shift_sessions(machine_id, operator_id, shift_type, planned_boxes, product_code)` | Configures target production per shift | 3.0 Prod Resource Mgmt | **Full** — includes planned_boxes + product_code from Epicor |
| Downtime Start (reason) | `oee_events(downtime_start)` | Operator selects stop reason from catalog (F-PD-21) | 3.3 Prod Execution | **Full** — via stop_reasons catalog with macro/category hierarchy |
| Downtime End | `oee_events(downtime_end)` | Closes active downtime, calculates duration | 3.3 Prod Execution | **Full** |
| Box Count | `oee_events(box_count)` | Operator registers production output | 3.3 Prod Execution | **Full** — with anomalous production guard |
| Reject Count | `oee_events(reject_count)` | Operator registers rejects | 3.3 Prod Execution | **Full** |
| OEE Calculation | `useOeeCalculator`, `core/oeeCalculator.ts` | Computes Availability, Performance, Quality in real-time | 3.6 Prod Perf Analysis | **Full** — but uses fallback PPM if no product selected |
| Dashboard KPIs | `useDashboardData`, `KpiCards` | Aggregated production metrics, bar charts | 3.6 Prod Perf Analysis | **Partial** — reactive but derived from local RxDB only, no analytical DB |
| Shift Summary (materialized) | `shift_summary` | Cached aggregates per shift (downtime, micro-stops, boxes) | 3.6 Prod Perf Analysis | **Full** — non-authoritative, always derivable |
| LiveOEE Summary | `LiveOeeSummary` component | Real-time OEE from event stream | 3.6 Prod Perf Analysis | **Full** |
| Production Dispatching | N/A | No work order dispatch from ERP to line | 3.2 Prod Dispatching | **MISSING** — Epicor produces production plans but no flow-down |
| Product Catalog | `products` (Hasura catalog) | Product list with theoretical PPM from Epicor | 3.0 Prod Resource Mgmt | **Full pull-only** — from Epicor via Hasura |
| Stop Reasons Catalog | `stop_reasons` (Hasura catalog) | Hierarchical reason codes (macro/category/reason) | 3.3 Prod Execution | **Full** — F-PD-21 compliant |

### Maintenance Operations

| Feature | File/Table | What it does | ISA-95 Function | Completeness |
|---------|-----------|-------------|-----------------|--------------|
| Downtime Conciliation | `downtime_conciliation`, `useDowntimeConciliation` | Bridge: Production downtime → Maintenance root cause → OT trigger | 3.0 Maint Data Collection (bridge) | **Full** — two-step diagnosis (prod + maint), reconciled/disputed |
| OT Trigger (oee-trigger) | `epicor_sync_queue(OEE_MTTO_TRIGGER)` → cmms-ibero `oee-trigger` | Creates corrective WO in CMMS from production downtime | 3.3 Maint Execution | **Full** — fire-and-forget via outbox |
| Conciliation → OT flow | Trigger `enqueue_oee_mtto_trigger()` | Encues OEE_MTTO_TRIGGER when: (a) MTTO downtime inserted, (b) reconciled with MTTO macro | 3.3 Maint Execution | **Full** — includes union worker polling |
| Work Orders (simple) | `work_orders` in RxDB | Local cache of WOs from cmms-ibero | 3.5 Maint Tracking | **Partial** — read-only, limited fields |
| Assets (local) | `assets`, `asset_types` in RxDB | Equipment master with warranty, serial, location | 3.0 Maint Resource Mgmt | **Partial** — CMMS is authoritative |
| CMMS Work Orders (full) | cmms-ibero `work_orders` (ISO 14224) | Full lifecycle with FSM, failure taxonomy, notes | 3.3-3.6 Maint | **Full** — in cmms-ibero |
| PM Schedules | cmms-ibero `pm_schedules`, `job_plans` | Preventive maintenance scheduling, task/material snapshots | 3.2 Maint Dispatching | **Full** — in cmms-ibero |
| Condition Monitoring | cmms-ibero `meters`, `measure_points`, `meter_readings` | CBM via meter readings with threshold alerts | 3.4 Maint Data Collection | **Full** — in cmms-ibero |
| PM Engine (Automata) | cmms-ibero PM Engine | Scans due schedules, resolves suppression chains, generates WOs | 3.2 Maint Dispatching | **Full** — in cmms-ibero |
| Job Plan Hierarchy | cmms-ibero `job_plans(master_plan_id, plan_level)` | Multi-level plan hierarchy with recursive CTE | 3.1 Maint Resource Mgmt | **Full** — in cmms-ibero |
| Competency Engine | cmms-ibero competency specs | Technician skill levels, assignment soft-lock | 3.1 Maint Resource Mgmt | **Full** — in cmms-ibero |

### Quality Operations

| Feature | File/Table | What it does | ISA-95 Function | Completeness |
|---------|-----------|-------------|-----------------|--------------|
| Quality Inspection (create) | `quality_inspections` + `capture.tsx` | Inspector selects disposition (liberado/rechazado/reproceso) | 3.3 Quality Execution | **Full** — includes shift_type, machine_id, data_source audit |
| Defect Logging | `defect_logs` | Free-text defect type, severity, count | 3.4 Quality Data Collection | **Full** |
| Weight Logging | `weight_logs` | Measured weight per sample | 3.4 Quality Data Collection | **Full** |
| Weight Validation | `product_weight_standards` + `validateWeight()` | Validates weight against SKU limits | 3.4 Quality Data Collection | **Full** — offline-capable via local cache |
| Inspection List | `quality/index.tsx` | Reactive list filtered by machine | 3.5 Quality Tracking | **Full** |
| Inspection Detail | `quality/[id].tsx` | Read-only detail with children | 3.5 Quality Tracking | **Full** |
| Quality → Epicor Outbox | Trigger `enqueue_quality_disposition()` → `epicor_sync_queue(QUALITY_DISPOSITION)` | Sends QC disposition to Epicor | 3.6 Quality Perf Analysis (integration) | **Full** |
| SPC / Control Charts | N/A | Statistical process control | 3.6 Quality Perf Analysis | **MISSING** |
| Quality Resource Mgmt | N/A | Calibration schedules, test equipment tracking | 3.1 Quality Resource Mgmt | **MISSING** |
| Quality Dispatching | N/A | Scheduling quality checks per production order | 3.2 Quality Dispatching | **MISSING** |

### Inventory Operations

| Feature | File/Table | What it does | ISA-95 Function | Completeness |
|---------|-----------|-------------|-----------------|--------------|
| Material Receipt (Epicor → CMMS) | cmms-ibero `epicor-webhook` | Epicor sends material receipt → records transaction, unblocks WO | 3.4 Inventory Data Collection | **Full** — in cmms-ibero |
| Material → WO Snapshot | cmms-ibero `work_order_material_snapshots` | Frozen copy of planned materials at WO generation | 3.0 Inventory Resource Mgmt | **Full** — in cmms-ibero |
| Raw Feed Tags (future) | Proposed: `raw_feed_tags` collection | Track raw material lot → finished product traceability | 3.5 Inventory Tracking | **MISSING** — in design |
| Material Availability (WMS) | Epicor (ERP) | WMS-level inventory, stock levels, lot tracking | 3.1 Inventory Resource Mgmt | **Epicor only** — no Level 3 WMS |
| Production Material Consumption | N/A | What material was consumed per shift/order | 3.4 Inventory Data Collection | **MISSING** |
| Inventory Performance Analysis | N/A | Inventory turns, scrap analysis | 3.6 Inventory Perf Analysis | **MISSING** |

### Cross-Cutting / Integration

| Feature | File/Table | What it does | ISA-95 Function | Completeness |
|---------|-----------|-------------|-----------------|--------------|
| epicor_sync_queue (outbox) | Shared table (Hasura) | Unified outbox for SHIFT_CLOSED, QUALITY_DISPOSITION, OEE_MTTO_TRIGGER | Level 3→4 Integration | **Full** — shared worker pattern |
| Shift Closed → Epicor | Trigger `enqueue_shift_closed()` | Sends shift summary to Epicor post-close | L3→L4 Integration | **Full** |
| Quality Disposition → Epicor | Trigger `enqueue_quality_disposition()` | Sends QC results to Epicor | L3→L4 Integration | **Full** |
| OEE MTTO → CMMS | Trigger → `epicor_sync_queue` → worker → `oee-trigger` function | Creates corrective WO in cmms-ibero | L3 Maint↔Prod Integration | **Full** |
| Plant Config | `plant_config` table + settings UI | Plant-level parameters (micro_stop_threshold) | L3 Config | **Full** — editable from settings |
| Dead Letter Queue | `sync_errors` + `supervisor.tsx` | Supervisor manages failed sync events | Sync Resilience | **Full** — discard/retry per event |
| IoT Machine Flag | `machines(is_iot_enabled)` | Flags machines with IoT sensor coverage | L2↔L3 Integration | **Full** — but telemetry ingestion not yet built |
| Sync Status Monitor | `SyncMonitor`, `useReplicationStatus` | Real-time replication status per collection | Cross-cutting | **Full** |
| Power BI Integration | `SettingsPowerBI` component | Deep-link to Power BI dashboards | L4 Analytics | **Full** — static deep-link |
| Catalogs Admin | `SettingsCatalogs` | Admin CRUD for stop_reasons, lines, machines | L3 Config | **Full** |

---

## 4. B. MESA 11 Functional Areas — Gap Analysis

The MESA International model defines 11 functional areas for MES. Here is our coverage:

| # | MESA 11 Function | Our Coverage | What's Missing | Should Be In | Priority |
|---|-----------------|-------------|---------------|-------------|----------|
| 1 | **Resource Allocation & Status** | ✅ **Partial** | Machine status is manual (OEE events). No automatic resource state from PLC. No labor skill tracking at production level (cmms-ibero has it for maintenance). | ibarra-iot-gateway (auto status) + our app (display) | **Medium** |
| 2 | **Dispatching Production Orders** | ❌ **No** | Production orders from Epicor are NOT dispatched to lines. Operators don't see "what to produce" — they just enter what they produced. | Epicor → Hasura → our app | **High** — this is the biggest gap |
| 3 | **Data Collection / Acquisition** | ✅ **Full** | oee_events capture all production data offline-first. Quality data via inspections. | — | — |
| 4 | **Quality Management** | ✅ **Partial** | Inspection capture is complete. Missing: SPC, control charts, calibration mgmt, sampling plans per product, quality dashboards. | our app (extend) | **Medium** |
| 5 | **Maintenance Management** | ✅ **Full (in cmms-ibero)** | CMMS has full ISO 14224 WOs, PM engine, CBM, competency engine. Production app has the conciliation bridge. | cmms-ibero | — |
| 6 | **Performance Analysis** | ✅ **Partial** | OEE calculation is real-time and good. Missing: trend analysis across shifts/weeks, OEE target comparison, energy monitoring, waste analysis. | our app + Power BI | **Low** (Power BI covers analytics) |
| 7 | **Operations / Detail Scheduling** | ❌ **No** | No detailed scheduling at Level 3. Epicor does high-level planning (Level 4). No sequencing, no line balancing. | Epicor (Level 4) or future APS | **Low** (Epicor covers this) |
| 8 | **Process Management** | ✅ **Partial** | Production execution monitoring is covered (OEE events). Missing: recipe/parameter mgmt, setpoint control, product genealogy, digital work instructions. | our app + ibarra-iot-gateway | **Medium** |
| 9 | **Labor Management** | ✅ **Partial** | Shift sessions track operator-machine assignment. Missing: attendance, time tracking, certification tracking, performance-based labor assignment. | our app (extend) + HR (Epicor) | **Medium** |
| 10 | **Document Control** | ❌ **No** | No document management: work instructions, SOPs, forms, drawings, version control. | our app (future module) | **Low** |
| 11 | **Product Tracking & Genealogy** | ✅ **Partial** | OEE events track box_count per shift. Missing: lot traceability, serialization, raw material → finished product chain. | our app (future) | **Low** (for now) |

### Priority Matrix

```
HIGH (must fix):
├── Dispatching Production Orders (MESA #2)
│   └── Solution: Epicor → Hasura event → our app shows "today's plan"
│
MEDIUM (should have):
├── Resource Allocation & Status (MESA #1)
│   └── IoT auto-status + labor skills from cmms-ibero
├── Quality Management (SPC) (MESA #4)
│   └── Control charts, sampling plans
├── Process Management (MESA #8)
│   └── Recipes/parameters from Epicor, digital work instructions
├── Labor Management (MESA #9)
│   └── Attendance, certification tracking
│
LOW (nice to have):
├── Performance Analysis (Power BI covers this)
├── Operations Scheduling (Epicor covers this)
├── Document Control
└── Product Genealogy
```

---

## 5. C. Clear System Boundaries

### produccion-ibarra (Our App) — OWNS:

| Domain | Exclusive Owner | Rationale |
|--------|----------------|-----------|
| OEE Event Capture | ✅ Yes | Atomic production events (shift, downtime, count) — operator-facing |
| Shift Session Management | ✅ Yes | Start/close shift, operator-machine assignment per shift |
| Downtime Conciliation (Prod side) | ✅ Yes | Supervisor diagnoses root cause, reconciles/disputes |
| Quality Inspections (Manual) | ✅ Yes | Inspector captures disposition, defects, weights |
| Plant-Level Configuration | ✅ Yes | `plant_config`, `micro_stop_threshold`, etc. |
| Offline-First Sync | ✅ Yes | RxDB + Hasura replication — our app's core differentiator |
| Dead Letter Queue | ✅ Yes | Supervisor manages sync errors |

### produccion-ibarra — SHARES (Integration Points):

| Domain | Shared With | What |
|--------|-----------|------|
| Production Events (SHIFT_CLOSED) | → Epicor | Outbox via `epicor_sync_queue` |
| Quality Events (QUALITY_DISPOSITION) | → Epicor | Outbox via `epicor_sync_queue` |
| MTTO Triggers (OEE_MTTO_TRIGGER) | → cmms-ibero | Outbox via `epicor_sync_queue` → worker → oee-trigger function |
| Machines Catalog | Hasura (shared) | Lines, machines from Epicor via ETL |
| Products Catalog | Hasura (shared) | Products with theoretical_ppm from Epicor |
| Operator Roster | Hasura (shared) | Operators from Epicor payroll |
| Assets | ↔ cmms-ibero | RxDB locally caches; CMMS is authoritative for maintenance attributes |

### produccion-ibarra — NEVER Do:

| Prohibited | Why |
|-----------|-----|
| Create/Edit maintenance work orders | That's cmms-ibero's job — we only trigger OT creation |
| Manage inventory or stock levels | Epicor owns inventory (Level 4), no WMS at Level 3 yet |
| Manage HR/payroll data | Epicor owns HR. We only consume operator codes |
| Plan production schedules | Epicor does production planning (Level 4) |
| Control PLCs or machines | ibarra-iot-gateway owns Level 2 — we consume telemetry |
| Replace CMMS functionality | Different domain: maintenance lifecycle (WAPPR→COMP→CLOSED) |
| Replace LIMS functionality | No LIMS yet — but quality data stays in our app (it's operational QC, not lab) |

### cmms-ibero — OWNS:

| Domain | Exclusive Owner | Rationale |
|--------|----------------|-----------|
| Work Order Lifecycle | ✅ Yes | ISO 14224 FSM: WAPPR → APPROVED → INPRG → COMP → CLOSED |
| Asset Management (Detailed) | ✅ Yes | Equipment master with failure history, criticality |
| PM/CBM Schedules | ✅ Yes | Time/meter-driven preventive maintenance |
| Job Plans / Plan Hierarchy | ✅ Yes | Task/material/labor/safety templates with versioning |
| Competency Management | ✅ Yes | Technician skill levels, evidence, assignment soft-lock |
| Maintenance Audit Trail | ✅ Yes | Immutable audit_logs on all tables |
| Material Receipts (from Epicor) | ✅ Yes | Via epicor-webhook function |
| Inventory Transactions (MRO) | ✅ Yes | Spare parts inventory (future WMS integration) |

### cmms-ibero — NEVER Do:

| Prohibited | Why |
|-----------|-----|
| Capture production OEE | That's our app's core function |
| Record quality inspections | Our app owns QC (operational, not lab) |
| Manage shifts or operators | Our app owns shift management |
| Initiate its own OEE triggers | OEE_MTTO_TRIGGER comes from our app's downtime conciliation |

### Epicor (ERP) — OWNS:

| Domain | Owner | Integration |
|--------|-------|-------------|
| Production Planning/Scheduling | ✅ Epicor | Needs to flow production orders DOWN to our app (GAP) |
| MRP / Supply Chain | ✅ Epicor | — |
| Finance / Accounting | ✅ Epicor | — |
| Payroll / HR | ✅ Epicor | Operator codes flow DOWN to our app |
| Inventory (RM/FG) | ✅ Epicor | Stock levels, lot tracking |
| Product Master (BOM, routings) | ✅ Epicor | Products flow DOWN via Hasura |

### ibarra-iot-gateway — OWNS:

| Domain | Owner | Integration |
|--------|-------|-------------|
| PLC Communication (Modbus) | ✅ Gateway | Level 2 real-time |
| Vision Inspection (Cameras) | ✅ Gateway | GEMA-Vision, LPRNet OCR |
| Sensor Data (NORVI, LoRaWAN) | ✅ Gateway | Pulse counting, machine state |
| MQTT Telemetry | ✅ Gateway | Edge → Cloud (Hasura) |
| Edge Inference | ✅ Gateway | On-device AI for quality vision |

### ibarra-iot-gateway — NEVER Do:

| Prohibited | Why |
|-----------|-----|
| Store transactional production data | That's our app with RxDB |
| Manage shifts or operators | Not its domain |
| Serve as primary UI | It's a headless gateway |

---

## 6. D. Integration Points

### Current Integrations

```
                    EPICOR (Level 4)
                         │
                    ┌────┴────┐
                    │  BPM    │
                    │  Outbound│
                    └────┬────┘
                         │ Material Receipt
                         ▼
              ┌──────────────────────┐
              │ cmms-ibero           │
              │ epicor-webhook       │
              │ (Edge Function)      │
              └──────────────────────┘

                    HASURA (Shared DB)
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────┐
  │ produccion-  │ │ cmms-    │ │ ibarra-iot-  │
  │ ibarra       │ │ ibero    │ │ gateway      │
  │ (RxDB sync)  │ │ (Direct) │ │ (MQTT→WS)    │
  └──────┬───────┘ └────┬─────┘ └──────────────┘
         │              │
         │ epicor_sync_queue (SHARED OUTBOX)
         │              │
         ├──────────────┤
         │ SHIFT_CLOSED │ → Worker → Epicor
         │ QUALITY_DIS  │ → Worker → Epicor
         │ OEE_MTTO_TRIG│ → Worker → cmms-ibero oee-trigger
         └──────────────┘
```

### Detailed Data Flows

#### Flow 1: Epicor → produccion-ibarra (Downstream)

| Data | Current Status | Mechanism | Priority |
|------|---------------|-----------|----------|
| Products (code, name, theoretical_ppm) | ✅ Working | Epicor → Hasura (ETL) → RxDB pull sync | Production |
| Operators (id, full_name) | ✅ Working | Epicor → Hasura (ETL) → RxDB pull sync | Production |
| Lines, Machines | ✅ Working | Epicor → Hasura (ETL) → RxDB pull sync | Production |
| Shifts (catalog) | ✅ Working | Hasura catalog → Zustand + AsyncStorage | Production |
| Stop Reasons | ✅ Working | Hasura catalog → Zustand + AsyncStorage | Production |
| Product Weight Standards | ✅ Working | Epicor → Hasura → RxDB pull sync | Quality |
| **Production Orders** | ❌ **GAP** | Not flowing down — operators don't see planned orders | **HIGH** |
| BOM / Routings | ❌ **GAP** | Not used at Level 3 | **LOW** |

#### Flow 2: produccion-ibarra → Epicor (Upstream)

| Data | Current Status | Mechanism | Priority |
|------|---------------|-----------|----------|
| SHIFT_CLOSED (session summary) | ✅ Working | DB Trigger → `epicor_sync_queue` → Worker | Production |
| QUALITY_DISPOSITION (QC results) | ✅ Working | DB Trigger → `epicor_sync_queue` → Worker | Quality |
| OEE aggregate production | ❌ **GAP** | Not sent to Epicor. Could be part of SHIFT_CLOSED payload | **Medium** |
| Raw material consumption | ❌ **GAP** | Not tracked at Level 3 | **Low** |

#### Flow 3: produccion-ibarra → cmms-ibero

| Data | Current Status | Mechanism | Priority |
|------|---------------|-----------|----------|
| OEE_MTTO_TRIGGER (corrective WO request) | ✅ Working | Conciliation → `epicor_sync_queue` → Worker → `oee-trigger` Edge Function | Maintenance |
| Work order status updates | ❌ **GAP** | No flow back: our app doesn't show WO progress from CMMS | **Medium** |
| Asset updates | ❌ **GAP** | No sync of asset status changes (active/maintenance/retired) | **Low** |

#### Flow 4: cmms-ibero → Epicor

| Data | Current Status | Mechanism | Priority |
|------|---------------|-----------|----------|
| Material Receipt | ✅ Working | Epicor BPM → `epicor-webhook` Edge Function | Inventory |
| WO completion / labor | ❌ **GAP** | Not sent to Epicor for costing | **Medium** |
| PM-generated material requests | ❌ **GAP** | Not sent to Epicor for purchasing | **Medium** |

#### Flow 5: ibarra-iot-gateway → produccion-ibarra

| Data | Current Status | Mechanism | Priority |
|------|---------------|-----------|----------|
| Machine status (running/stopped) | ❌ **GAP** | Not ingested. `is_iot_enabled` flag exists on machines | **Medium** |
| Automatic box count | ❌ **GAP** | Could replace manual numpad entry | **Medium** |
| Vision QC results | ❌ **GAP** | Could create quality_inspections automatically (data_source='vision') | **High** |
| Telemetry → OEE events | ❌ **GAP** | Auto-generate downtime_start/end from machine state | **Medium** |

---

## 7. E. Architecture Decision Records (Implicit)

The following architectural principles are embedded in the current design:

### AD-1: Outbox Pattern (epicor_sync_queue)
- **What**: All Level 3 → Level 4 events go through a shared `epicor_sync_queue` table with status, next_retry_at, event_type
- **Why**: Decouples Level 3 from Level 4. Worker poll handles backoff, retry, ordering
- **Where**: `019_epicor_outbox_align.sql`, shared between produccion-ibarra and cmms-ibero

### AD-2: Offline-First with RxDB
- **What**: All transactional data stored locally in RxDB (IndexedDB/Dexie), synced via GraphQL replication
- **Why**: Industrial environment with unreliable connectivity; operators must work offline
- **Where**: All repositories, sync.ts, DatabaseContext

### AD-3: LWW Conflict Resolution
- **What**: Last-Write-Wins based on `client_updated_at` / `updated_at` timestamp
- **Why**: Simpler than CRDT for mobile → server synchronization; acceptable for production data

### AD-4: CMMS Owns Maintenance Lifecycle
- **What**: cmms-ibero is the authoritative system for work orders, assets, PM schedules
- **Why**: Clear boundary — our app triggers OT creation but never manages the lifecycle

### AD-5: Epicor is System of Record for Master Data
- **What**: Products, operators, lines, machines come from Epicor
- **Why**: Single source of truth; our app is a consumer with local cache

### AD-6: Container/Presenter Pattern
- **What**: Screens are thin containers; all logic in orchestrator hooks
- **Why**: Testability, separation of concerns, clean React components

### AD-7: Two-Step Conciliation
- **What**: Production supervisor diagnoses first, maintenance mechanic second, supervisor reconciles
- **Why**: Accountability — both sides must agree before OT trigger fires

---

## 8. F. Recommendations

### High Priority (Phase: epicor-production-orders)

1. **Epicor → produccion-ibarra: Production Orders**
   - Epicor sends production orders (what to produce, how many, by when) to Hasura
   - Our app shows "Today's Plan" per machine — operator sees target
   - `shift_sessions.planned_boxes` already exists — just needs proper source from Epicor
   - **Effort**: Low-Medium (Hasura event + UI component)
   - **Files affected**: new `production_orders` table, shift setup screen

2. **ibarra-iot-gateway → produccion-ibarra: Vision QC Integration**
   - Camera detects defects → auto-create `quality_inspections` with `data_source='vision'`
   - Already has `data_source` enum support in schema
   - **Effort**: Medium (gateway → Hasura → RxDB)
   - **Files affected**: quality capture flow (already supports 'vision' and 'hybrid')

### Medium Priority (Phase: iot-telemetry)

3. **Machine Auto-Status from IoT**
   - NORVI pulses + Modbus PLC data → auto-detect running/stopped state
   - Auto-generate downtime_start/downtime_end events in RxDB
   - Operator only confirms reason_code, not manual start/end
   - **Effort**: Medium-High (new sync pipeline from gateway)

4. **WO Status from CMMS → produccion-ibarra**
   - Show in conciliation screen: "OT-12345 — In Progress" instead of just `ot_sent=true`
   - **Effort**: Low (RxDB pull sync for work_orders, add fields)

5. **SPC / Control Charts for Quality**
   - Trend weight_logs over time, show control limits
   - Alert when trending toward out-of-spec
   - **Effort**: Medium (charts library + statistical functions)

### Low Priority (Phase: analytics)

6. **OEE Aggregates → Power BI / Epicor**
   - Send OEE_KPI events to Epicor for enterprise dashboards
   - Currently SHIFT_CLOSED has basic data — add OEE metrics to payload

7. **Document Control Module**
   - SOPs, work instructions, forms attached to machines/products
   - Purely informational — no workflow required

8. **Material Lot Traceability**
   - `raw_feed_tags` table: track raw material lot → shift → finished product
   - Integration with Epicor lot tracking

---

## Summary: Where We Stand vs. Commercial MES

| Capability | Siemens Opcenter | Rockwell FactoryTalk | produccion-ibarra + cmms-ibero |
|-----------|-----------------|---------------------|-------------------------------|
| OEE / Downtime | ✅ | ✅ | ✅ Full |
| Shift Management | ✅ | ✅ | ✅ Full |
| Quality Inspections | ✅ | ✅ | ✅ Full (no SPC yet) |
| Work Orders / CMMS | ✅ | ✅ | ✅ Full (in cmms-ibero) |
| PM / CBM | ✅ | ✅ | ✅ Full (in cmms-ibero) |
| Production Dispatching | ✅ | ✅ | ❌ Gap — no order flow from Epicor |
| IoT / Machine Integration | ✅ | ✅ | Partial — gateway built, ingestion pending |
| SPC / Analytics | ✅ | ✅ | ❌ Missing in our app |
| Document Control | ✅ | ✅ | ❌ Missing |
| Recipe Management | ✅ | ✅ | ❌ Missing |
| Material Traceability | ✅ | ✅ | ❌ Missing |
| Offline-First | ❌ (typically) | ❌ (typically) | ✅ **Unique advantage** |
| Integration Std (ISA-95) | ✅ Native | ✅ Native | Partial — via epicor_sync_queue outbox |

### Key Finding

**produccion-ibarra + cmms-ibero + ibarra-iot-gateway collectively cover ~70% of a typical commercial MES**, with the **offline-first capability being a unique differentiator** that commercial MES (Opcenter, FactoryTalk, AVEVA) do NOT offer natively — they require always-on connectivity.

The biggest gap is **production order dispatching** (MESA #2), which is the fundamental feed-forward from ERP. Without it, operators work without knowing the plan — they only report what they did, not what they should do.

---

*Document generated by SDD Explore — Deep Research. All referenced files audited on 2026-05-29.*
