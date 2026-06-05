# Pipeline DevOps — produccion-ibarra

> Documento de arquitectura de pruebas y entrega continua.
> Define la jerarquía de pruebas, el flujo CI/CD, la estrategia de ramas,
> y el ciclo de retroalimentación con observabilidad.

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

---

## Estrategia de Ramas (Git Flow simplificado)

```
main (producción)
  ↑
  └── PRs desde ramas feat/* o fix/*
       • Cada PR ejecuta el pipeline completo
       • Si algo falla → NO se mergea
       • Code review obligatorio (al menos 1 approval)
       • Commits convencionales (feat:, fix:, docs:, chore:)
```

**Reglas:**
- `main` siempre está deployable
- No hay `develop` ni `staging` por ahora (equipo chico, despliegue directo a Vercel)
- Los hotfixes van directo a `main` con PR urgente
- Cada release se taggea con versión semántica (ej: `v1.0.0`)

## Estrategia de Release

```
1. PR a main → pipeline CI/CD
2. Si pasa → merge automático
3. Deploy automático a Vercel (URL de preview)
4. Prueba en piso con el PCC
5. Si todo ok → tag release (v1.x.x)
6. Si algo falla → hotfix → repeat
```

**Versiones:**
- Formato: `v{major}.{minor}.{patch}` (semver)
- Major: cambios que rompen compatibilidad
- Minor: nuevas funcionalidades
- Patch: bug fixes

## Entornos

| Entorno | URL | Uso |
|---------|-----|-----|
| **Producción** | Vercel (produccion-ibarra.vercel.app) | Uso del PCC en planta |
| **Preview** | Vercel (PR-specific URL) | Pruebas antes de mergear |

Por ahora no hay staging separado. Cada PR genera su propia URL de preview en Vercel.

## Calidad de Código (QA Gates)

Además de los tests, el pipeline verifica:

| Gate | Herramienta | Qué detecta |
|------|-------------|-------------|
| **Linter** | ESLint | Errores de sintaxis, malas prácticas |
| **TypeScript** | `tsc --noEmit` | Errores de tipos |
| **Formato** | Prettier | Inconsistencias de formato |
| **Coverage** | Jest --coverage | Umbrales por archivo crítico |
| **Mutación** | Stryker | Tests que no validan realmente |
| **Build** | Expo export | Errores de compilación |
| **E2E** | Playwright | Regresiones en flujos críticos |

## Post-Release (Ciclo de retroalimentación)

```
Release a piso
  │
  ├── Sentry captura errores
  │     └── Cada error → Issue → Test → Fix
  │
  ├── Logs de uso
  │     └── ¿Qué pantallas usan más? ¿Dónde batallan?
  │
  ├── Feedback del PCC/supervisor
  │     └── ¿El flujo tiene sentido? ¿Faltan códigos?
  │
  └── Métricas de calidad
        └── ¿Subió el OEE? ¿Bajaron los paros?
```

## Próximos Pasos (priorizados)

1. 🟢 **Stryker** — Ya configurado, ejecutar primera vez para línea base
2. 🟡 **sync.ts** — Tests para la lógica de sincronización (funciones puras)
3. 🟡 **shiftReportGenerator** — Tests para generación de reportes OEE
4. 🔴 **Repositorios** — Tests con RxDB en memoria (requiere `rxdb/plugins/test-utils`)
5. 🔴 **E2E** — Escribir primer test de ciclo completo de turno
6. ⚡ **Sentry** — Monitorear primeras horas en piso y crear tests de regresión
