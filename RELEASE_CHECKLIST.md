# Release Checklist — Chocolate Ibarra PWA

> Checklist para el deploy a producción y rollback del frontend PWA y Nhost Functions.

## Rollback Procedure

### Vercel (Frontend)

1. Ir al [Vercel Dashboard](https://vercel.com/)
2. Seleccionar el proyecto `chocolate-ibarra`
3. Ir a **Deployments**
4. Hacer clic en **"Rollback to previous"** (un solo clic)
5. Verificar que la app carga correctamente en la URL de producción

### Nhost (Backend Functions)

```bash
# Opción 1: Revertir a una versión específica
nhost functions revert <version>

# Opción 2: Re-desplegar código anterior
# 1. Checkout el commit anterior con las funciones estables
git checkout <stable-commit-hash>
# 2. Desplegar desde la carpeta functions/
nhost deploy --remote
```

### Git (Código fuente)

```bash
# Opción 1: Revertir el commit del release (recomendada)
git revert v1.0.0
git push origin main

# Opción 2: Reset forzado a último commit estable (solo si hay acuerdo en el equipo)
git reset --hard <last-stable-commit>
git push --force-with-lease origin main
```

## Deploy Verification Steps

- [ ] **1. Push a main** — El trigger de CI se activa automáticamente
- [ ] **2. CI pipeline** — Verificar que todos los pasos pasan en GitHub Actions:
  - TypeScript typecheck (`bun run typecheck`)
  - ESLint (`bun run lint`)
  - Unit tests con coverage (`bun run test:ci`)
  - Mutation tests (Stryker)
  - Playwright E2E tests
  - Build PWA (`bun run build:web`)
  - Deploy a Vercel
- [ ] **3. Vercel deployment** — Confirmar en el dashboard de Vercel que el deploy se completó correctamente
- [ ] **4. PWA en producción** — Cargar la app en la URL de producción y verificar:
  - La pantalla de login carga sin errores
  - Las variables de entorno se cargaron correctamente (`EXPO_PUBLIC_NHOST_SUBDOMAIN`, etc.)
  - El botón de PowerBI **no aparece** (no está configurado en producción)
- [ ] **5. Sentry** — Verificar que Sentry está capturando errores:
   1. Abrir la consola del navegador en producción
   2. Ejecutar: `import('/src/lib/sentry').then(m => m.triggerSentryTest())`
   3. Ir al [dashboard de Sentry](https://sentry.io/) y confirmar que el error de prueba aparece en **Issues**
   4. También verificar que no hay errores inesperados
- [ ] **6. Tag release** — Una vez que el deploy está verde y verificado:

```bash
git tag -a v1.0.0 -m "First production release"
git push origin v1.0.0
```
