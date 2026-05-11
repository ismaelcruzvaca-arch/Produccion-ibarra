# Roadmap — Chocolate Ibarra Producción

> Documento vivo. Última actualización: 2026-05-11.

## Visión
Transformar la captura de datos de producción en una experiencia offline-first, robusta y observable, desplegable con un solo `git push` y monitoreada en tiempo real.

---

## Fase 1: Estabilidad de Despliegue (Pilar 1) 🔧
**Estado**: En progreso | **Objetivo**: Cero despliegues a ciegas

- [x] Fix de URLs hardcodeadas en `sync.ts` → variables de entorno `EXPO_PUBLIC_NHOST_SUBDOMAIN`
- [x] Guarda de entorno web en `DatabaseContext.tsx` para evitar crash del módulo `ws`
- [x] Scripts de build/serve estandarizados (`build:web`, `serve:web`, `clean:cache`)
- [x] `.env.example` como contrato de variables requeridas
- [x] Servidor SPA con Bun (`serve-dist.mjs`) para validación local idéntica a Vercel
- [x] Sentry Error Boundary global instalado y listo para activar con DSN
- [ ] Inyección de `EXPO_PUBLIC_NHOST_SUBDOMAIN` en Vercel desde GitHub Actions
- [ ] Primer deploy 100% exitoso en Vercel con datos de Nhost visibles

**Definition of Done**: La app carga en Vercel, autentica con Nhost y muestra datos reales sin errores de consola críticos.

---

## Fase 2: Captura OEE (Pilar 2) 📊
**Estado**: Implementado v1 | **Objetivo**: Captura offline-first de métricas de producción

- [x] Esquema RxDB `reports` con campos flexibles `data: object`
- [x] Repositorio reactivo `useReportsRepository` con CRUD + soft delete
- [x] Formulario de captura optimizado para tablet industrial (touch targets ≥48dp)
- [x] Sync GraphQL bidireccional (push/pull) con Nhost
- [ ] Validaciones de negocio (máximos, mínimos, campos obligatorios)
- [ ] Soporte para múltiples turnos y líneas de producción
- [ ] Cálculo automático de OEE (Disponibilidad × Rendimiento × Calidad)

**Definition of Done**: Un operador puede capturar un reporte completo en tablet, guardar offline y verlo reflejado en Nhost al recuperar conectividad.

---

## Fase 3: Dashboard Ejecutivo (Pilar 3) 📈
**Estado**: Planeado | **Objetivo**: Visibilidad en tiempo real para toma de decisiones

- [ ] Vista consolidada de OEE por línea, turno y rango de fechas
- [ ] Gráficos de tendencia (react-native-chart-kit o Recharts Web)
- [ ] KPIs críticos: MTBF, MTTR, Scrap Rate, Throughput
- [ ] Filtros dinámicos por fecha, supervisor y tipo de paro
- [ ] Modo "TV" (pantalla grande sin interacción) para área de producción

**Definition of Done**: El supervisor puede ver en una tablet o TV el estado de la planta en los últimos 24h sin necesidad de refrescar manualmente.

---

## Fase 4: Monitoreo y Alertas (Pilar 4) 🚨
**Estado**: Parcial (Sentry instalado) | **Objetivo**: Observabilidad completa del sistema y la producción

- [x] Sentry para errores de frontend (crash reports, stack traces)
- [ ] Métricas de rendimiento (Web Vitals, tiempo de carga)
- [ ] Alertas por umbral de producción (ej: OEE < 60% por > 30 min)
- [ ] Alertas de sincronización fallida (RxDB → Nhost)
- [ ] Log centralizado de operaciones críticas (quién, qué, cuándo)
- [ ] Health check endpoint para monitoreo externo

**Definition of Done**: El equipo de IT recibe una alerta en < 5 min si la app deja de sincronizar o si la producción cae bajo umbral crítico.

---

## Fase 5: Integraciones (Pilar 5) 🔌
**Estado**: Planeado | **Objetivo**: Conectar el ecosistema productivo

- [ ] Webhook para ERP (SAP / Odoo / custom) al cerrar turno
- [ ] Exportación de reportes a Excel/PDF para auditorías
- [ ] Integración con sensores IoT (opcional, vía API intermedia)
- [ ] Single Sign-On (SSO) con Azure AD / Google Workspace
- [ ] API pública (GraphQL) para consumo de datos por BI externo

**Definition of Done**: Al cerrar turno, los datos fluyen automáticamente al ERP y generan el reporte PDF para el supervisor sin intervención manual.

---

## Notas de Arquitectura

- **Offline-first obligatorio**: Todas las fases deben funcionar sin conexión y sincronizar cuando ésta regrese.
- **CI/CD es requisito, no opcional**: Ninguna fase se considera "Done" hasta que su código pase por GitHub Actions y se despliegue exitosamente en Vercel.
- **Mobile + Web**: El target principal es tablet Android (Chrome PWA), pero el código debe ser compatible con iOS y web desktop.

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-05-11 | Creación inicial del roadmap con 5 pilares | Open Code |
