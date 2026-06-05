# Pipeline de Pruebas — produccion-ibarra

> Documento de arquitectura de testing.
> Define la jerarquía, herramientas y criterios de calidad.

---

## Jerarquía de Pruebas

```
                    ⚡ OBSERVABILIDAD (Sentry)
                    Errores en producción → crean nuevos tests
                    ────────────────────────────────────────
                    🔄 E2E (Playwright)
                    Ciclo completo: turno → cierre → conciliación
                    ────────────────────────────────────────
                    🧪 INTEGRACIÓN (Jest)
                    Hooks + repositorios + flujos de negocio
                    ────────────────────────────────────────
                    🔬 MUTACIÓN (Stryker)
                    Validación de calidad de los tests
                    ────────────────────────────────────────
                    ✅ UNITARIOS (Jest)
                    Funciones puras, DTOs, migraciones, cálculos
```

## Capa 1: Tests Unitarios — Jest (573 tests)

**Qué probamos:**
- Funciones puras sin dependencias externas
- DTOs (toGraphQL / fromGraphQL) — 110+ tests
- Migraciones de esquemas RxDB — 30+ tests
- Cálculos OEE (computeOee) — 14 tests
- Cálculos de tendencias (qualityTrendsCalculator) — tests existentes
- Hooks con lógica extraíble (useShiftClose) — 30+ tests

**Thresholds de cobertura por archivo:**
| Archivo | Statements | Branches | Functions |
|---------|-----------|----------|-----------|
| src/graphql/dto.ts | 70% | — | 70% |
| src/core/oeeCalculator.ts | 80% | 70% | 100% |
| src/core/qualityTrendsCalculator.ts | 80% | — | 100% |
| src/data/migrations.ts | 80% | — | 90% |

**Comando:** `npm test`

## Capa 2: Mutación — Stryker

**Qué valida:** Que los tests no solo cubran código, sino que realmente detecten errores. Stryker muta el código (ej: cambia `>` por `<`) y verifica que los tests fallen.

**Configuración:**
- Threshold break: 50% (si baja de 50%, CI falla)
- Threshold low/high: 60/80
- Archivos mutados: src/core/, src/data/migrations.ts, src/graphql/dto.ts, src/ui/hooks/useShiftClose.ts

**Comando:** `npm run test:mutation`

## Capa 3: Tests de Integración — Jest

**Qué probamos:**
- Hooks con lógica de negocio que dependen de repositorios mockeados
- Flujos completos: cierre de turno, conciliación, clasificación
- Validación de reglas de negocio (recurrencia, departamentos, thresholds)

**Estado actual:** Tests de hooks implementados (useShiftClose, useDowntimeConciliation).
Pendiente: tests de repositorios con RxDB en memoria.

## Capa 4: E2E — Playwright

**Qué probamos:** Ciclo completo en web:
1. Iniciar turno
2. Registrar cajas, paros, rechazos
3. Cerrar turno con clasificación
4. Conciliar paros entre departamentos
5. Verificar que no hay errores de consola

**Comando:** `bunx playwright test`

**Estado actual:** Configuración existente en `.github/workflows/e2e.yml`.

## Capa 5: Observabilidad — Sentry

**Qué captura:**
- Errores no controlados (crashes)
- Errores de Red/API/Hasura
- Tiempos de respuesta lentos

**Flujo:** Cada error en producción → se crea un issue en Sentry → se escribe un test que reproduce el error → se arregla el código → el test queda como regresión.

**Estado actual:** DSN configurado en GitHub Secrets como `EXPO_PUBLIC_SENTRY_DSN`.

---

## Flujo CI/CD Completo

```
PR a main
  │
  ├── 1. npm test (Jest) ─────────── Unit + Integración
  │     ├── Coverage thresholds      ⚡ Falla si baja del mínimo
  │     └── 573 tests actuales
  │
  ├── 2. stryker run ──────────────── Mutación
  │     └── Threshold break: 50%    ⚡ Falla si mutación sobrevive
  │
  ├── 3. bunx playwright test ─────── E2E
  │     └── Ciclo completo en web
  │
  ├── 4. bun run build:web ────────── Build
  │
  ├── 5. Deploy a Vercel ──────────── Release
  │
  └── 6. Sentry ───────────────────── Observabilidad en producción
        └── Errores → Tests nuevos
```

## Próximos Pasos (priorizados)

1. 🟢 **Stryker** — Ya configurado, ejecutar primera vez para línea base
2. 🟡 **sync.ts** — Tests para la lógica de sincronización (funciones puras)
3. 🟡 **shiftReportGenerator** — Tests para generación de reportes OEE
4. 🔴 **Repositorios** — Tests con RxDB en memoria (requiere `rxdb/plugins/test-utils`)
5. 🔴 **E2E** — Escribir primer test de ciclo completo de turno
6. ⚡ **Sentry** — Monitorear primeras horas en piso y crear tests de regresión
