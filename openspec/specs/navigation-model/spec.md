# Navigation Model Specification

## Purpose

Unified navigation backbone for the production flow. Defines role-based tab ordering, a guided wizard state machine (Turno → Línea → OEE → Calidad → Cierre), Dashboard-as-tab, hidden FormRouter, integrated Shift Controls, and `shift_session_id` propagation across screens.

---

## Requirements

### NM-1: Dashboard as visible tab

The Dashboard (`index.tsx`) MUST appear as the first tab in the tab bar for ALL roles. It SHALL have a `view-dashboard` icon from `MaterialCommunityIcons`.

#### Scenario: User navigates back to Dashboard

- GIVEN the user is on any tab
- WHEN the user taps the Dashboard tab
- THEN the app navigates to the Dashboard screen
- AND the tab bar highlights Dashboard as active

#### Scenario: First screen on app launch

- GIVEN the user has an active session
- WHEN the app finishes loading
- THEN the Dashboard is the default selected tab
- AND the ProductionFlowBar shows the current wizard step

### NM-2: Role-based tab ordering

The tab bar order SHALL differ by role. Operators see 5 visible tabs; supervisors/admins see 6.

| Order | Operator | Supervisor / Admin |
|-------|----------|--------------------|
| 1 | Dashboard | Dashboard |
| 2 | OEE | OEE |
| 3 | Calidad | Calidad |
| 4 | Turnos | Turnos |
| 5 | Settings | Alertas |
| 6 | — | Settings |

#### Scenario: Operator sees correct tab order

- GIVEN the user role is `operator`
- WHEN the tab bar renders
- THEN tabs appear in order: Dashboard, OEE, Calidad, Turnos, Settings
- AND Alertas is NOT visible

#### Scenario: Supervisor sees correct tab order

- GIVEN the user role is `supervisor` or `admin`
- WHEN the tab bar renders
- THEN tabs appear in order: Dashboard, OEE, Calidad, Turnos, Alertas, Settings

#### Scenario: Role change updates tab bar

- GIVEN the user's role changes at runtime (rare, via profile refresh)
- WHEN the auth store role updates
- THEN the tab bar re-renders with the correct visibility and order

### NM-3: FormRouter as hidden tab

`forms.tsx` SHALL exist as a tab with `tabBarButton: () => null`. It MUST be accessible programmatically via `router.navigate('/forms')` from any screen.

#### Scenario: Operator opens FormRouter from machine selection

- GIVEN the operator has selected a machine from OeeSelectorBar
- WHEN the system resolves the machine to a form type
- THEN `router.navigate('/forms')` is called
- AND the FormRouter renders the correct form for that machine type

### NM-4: Guided flow with wizard state machine

A `ProductionFlowBar` component MUST display the current step of the wizard. The wizard is a state machine with 5 steps:

```
SHIFT_SELECTION → LINE_SELECTION → OEE → QUALITY → CLOSURE
```

| Step | Screen | When active |
|------|--------|-------------|
| 1. Turno | Shift List / Setup | No active shift |
| 2. Línea | Line Selector | No line selected |
| 3. OEE | OEE tab | Active shift + line selected |
| 4. Calidad | Quality tab | Active shift + inspections due |
| 5. Cierre | Close / Conciliation | Shift ending |

The wizard MUST carry: `shift_session_id`, `selectedLineId`, `selectedMachineId`.

Steps SHALL be skippable — the user MAY jump to any tab without completing previous steps.

#### Scenario: Wizard progress advances after shift start

- GIVEN the wizard is at step 1 (Turno) because no active shift exists
- WHEN the user starts a shift via OEE
- THEN `shift_session_id` is set in wizard state
- AND the wizard advances to step 3 (OEE)
- AND the ProductionFlowBar shows steps 1, 2, and 3 as completed

#### Scenario: Wizard does not block navigation

- GIVEN the wizard is at step 1 (Turno)
- WHEN the user taps the Calidad tab
- THEN the Quality screen opens normally
- AND the wizard shows an advisory prompt ("Iniciá un turno primero") but does NOT block the navigation

### NM-5: Shift Controls integrated in OEE

Shift start/end controls SHALL live inside the OEE screen. There SHALL NOT be a separate Shift Controls tab or screen. The OEE screen header MUST show: active shift session info, start/end shift buttons, and current shift duration.

#### Scenario: Start shift from OEE

- GIVEN the user is on the OEE screen
- AND there is no active shift session
- WHEN the user taps "Iniciar Turno"
- THEN a modal or drawer opens for shift setup (type, operator, planned boxes)
- AND on confirm, a new `shift_session` is created in RxDB
- AND the wizard advances to step 3

#### Scenario: End shift from OEE

- GIVEN the user is on the OEE screen
- AND there is an active shift session
- WHEN the user taps "Finalizar Turno"
- THEN the app navigates to the shift close flow (Close → Conciliation)
- AND the wizard advances to step 5

### NM-6: ConciliationScreen routed

The `ConciliationScreen` organism SHALL be reachable via route `/conciliation/{shiftSessionId}`. It MUST be wired into the shift close flow so that after closing a shift, the supervisor is directed to conciliation.

#### Scenario: Supervisor reconciles after shift close

- GIVEN the supervisor has closed a shift
- WHEN the shift close completes successfully
- THEN the app navigates to `/conciliation/{shiftSessionId}`
- AND the ConciliationScreen shows downtime events for classification

#### Scenario: Direct access to conciliation

- GIVEN the user is a supervisor or admin
- WHEN the user navigates to `/conciliation/{shiftSessionId}`
- THEN the ConciliationScreen loads with that shift's OEE events
- AND the user can classify stops as planned/unplanned

### NM-7: shift_session_id propagation

The active `shift_session_id` MUST be available across screens. It SHALL be stored in a Zustand store (or wizard state) and consumed by OEE, Quality, and Close screens.

#### Scenario: Quality inspections linked to shift

- GIVEN the user is on the Quality Capture screen
- AND there is an active `shift_session_id` in wizard state
- WHEN the user saves a new inspection
- THEN the inspection's `shift_session_id` field is populated with the active ID

### NM-8: Remove supervisor.tsx

The file `app/(tabs)/supervisor.tsx` SHALL be deleted. No route or import SHALL reference it.

#### Scenario: No dead route

- GIVEN the project compiles
- WHEN TypeScript resolves all imports in the tabs layout
- THEN there is NO reference to `supervisor.tsx`
- AND the build succeeds without errors

### NM-9: No emojis in production UI

All production screens MUST use `MaterialCommunityIcons` for icons. Emoji characters (Unicode emoji ranges) SHALL NOT appear in any JSX or text string rendered in the tabs layout.

#### Scenario: Settings screen uses icons, not emojis

- GIVEN the Settings screen renders
- WHEN inspecting all visible labels and icons
- THEN no Unicode emoji characters are present
- AND all icons use `MaterialCommunityIcons`

---

## Interfaces

### WizardState

```typescript
type WizardStep = 'shift' | 'line' | 'oee' | 'quality' | 'closure';

interface WizardState {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  shiftSessionId: string | null;
  selectedLineId: string | null;
  selectedMachineId: string | null;
  canSkip: boolean; // always true
}
```

### ProductionFlowBar Props

```typescript
interface ProductionFlowBarProps {
  steps: Array<{ key: WizardStep; label: string }>;
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  shiftSessionId: string | null;
}
```

---

## Edge Cases

| Condition | Behavior |
|-----------|----------|
| Offline, no active shift | Wizard stuck at step 1. User can navigate freely. No shift creation. |
| Offline, active shift | Wizard at step 3+. OEE/Quality work offline. Close blocked without sync. |
| Line not selected | Wizard shows step 2 as pending, but user can access OEE (assumes single-line assignment). |
| FormRouter with no machine selected | Resolver returns null; user sees "Seleccioná una máquina" message. |
| Role changes mid-session | Tab bar re-renders (NM-2). Wizard state preserved. |
| `shift_session_id` cleared (shift ended) | Wizard resets to step 1. Ongoing quality inspections orphaned — they keep the old ID. |

---

## Amendment: NM-2 Simplification (Design Decision)

**Date**: 2026-06-10
**Change**: app-integration
**Rationale**: Design review determined that role-based tab reordering adds unnecessary complexity without proportional UX benefit.

### What changed

NM-2 was simplified by design decision (see `openspec/changes/app-integration/design.md`):

- **All roles see the same 6 tabs**: Dashboard, OEE, Calidad, Turnos, Alertas, Ajustes.
- **No role-based reordering**: The tab order is identical for operator, supervisor, and admin.
- **Operator's Alertas tab**: Still visible in the tab bar but internally redirects to Dashboard if an operator tries to access it. This keeps the tab bar uniform while maintaining role boundaries.
- **No dynamic `tabBarButton` conditional**: The tab bar renders all 6 tabs unconditionally. Role filtering is delegated to individual screens.

### Files affected

- `app/(tabs)/_layout.tsx` — removed role-based tab visibility logic; all 6 tabs always render.
- Individual alerts screens — handle operator redirect internally if needed.

### Rationale for simplification

1. **Tab bar flicker**: Dynamic tab reordering caused a visible re-render when auth state resolved, creating a poor first-load experience.
2. **Operator never leaves tab bar**: Operators typically stay on OEE/Calidad/Turnos. The Alertas tab appearing but redirecting is less confusing than having it appear/disappear.
3. **Consistency**: All roles see the same chrome. Role-based content decisions happen inside screens, not in the navigation shell.

### Status

This amendment is CLOSED. The simplified NM-2 is the current implementation.

---

## Acceptance Criteria

- [ ] Dashboard is the first tab for every role
- [ ] Tab bar order matches the table in NM-2
- [ ] FormRouter is reachable only via `router.navigate('/forms')`
- [ ] ProductionFlowBar renders 5 steps with correct active/completed state
- [ ] Starting a shift from OEE sets `shift_session_id` and advances wizard
- [ ] Ending a shift navigates to Close → Conciliation
- [ ] ConciliationScreen loads at `/conciliation/{shiftSessionId}`
- [ ] `supervisor.tsx` file deleted, no import errors
- [ ] No emoji characters in production UI
- [ ] Existing specs unaffected (delta applies within new backbone)
