# Roadmap — Chocolate Ibarra Producción

> Documento vivo. Última actualización: 2026-06-03.

## Visión
App de producción para el piso de planta que reemplaza los formatos de papel, captura OEE con firmas digitales ISO 22000, y se integra con el ecosistema (CMMS Ibero, futuro Epicor) — offline-first, sin costo por máquina.

## Arquitectura Actual

```
Frontend:  Expo Web (PWA) → Vercel (GitHub Actions deploy)
Backend:   Nhost (Hasura GraphQL + Auth + Functions) → auto-deploy desde GitHub
DB:        PostgreSQL (Nhost) + RxDB local (IndexedDB)
IoT:       Gateway Raspberry Pi 5 (cloud_sync → producción directa)
CMMS:      cmms-ibero (edge function oee-trigger, pendiente cableado)
ERP:       Epicor (pendiente API)
```

## Lo que YA tenemos (Junio 2026)

### Core Producción
- [x] OEE: shift start/end, paros con causa, conteos, rechazos
- [x] Formularios digitales: Tostador (F-PD-16), Mezclado (F-PD-17), Extractor (F-PD-18), Vitaminas (F-PD-06)
- [x] Firma digital ISO 22000 en todos los formularios
- [x] Sync bidireccional de formularios a Hasura (recién implementado)
- [x] Stop reasons con CRUD admin
- [x] Products, lines, machines, shifts CRUD admin

### Calidad
- [x] Inspecciones de calidad (pass/fail, defectos, peso)
- [x] Sync calidad a Hasura

### Admin / Settings
- [x] Panel de administración completo (Profile, PowerBI, Catálogos, System)
- [x] User management (crear operadores con dummy emails, roles admin/supervisor/operator)
- [x] Catálogos: stop_reasons, lines, machines, products, shifts

### Integraciones
- [x] CMMS Ibero: edge function sync-plant-metadata + oee-trigger (pendiente cablear)
- [x] Nhost Functions: sync-role-metadata + admin-manage-user + sync-plant-metadata
- [x] Hasura RLS: todas las tablas con permisos por rol
- [x] RxDB sync: 9 colecciones sincronizadas (OEE, firmas, calidad, formularios)

### Infraestructura
- [x] Offline-first (RxDB + IndexedDB)
- [x] CI/CD: GitHub Actions → E2E Playwright → Vercel deploy
- [x] Nhost auto-deploy (migrations + functions desde GitHub)
- [x] Sentry error tracking
- [x] Replicación resiliente (backoff + circuit breaker + DLQ)
- [x] RxDB migration schema plugin (fixeado)
- [x] Catalog store con caché + invalidación

---

## Lo pendiente

### Sprint A: "Conciliación de Paros" (próximo)
- [ ] Pantalla de conciliación al fin de turno (operador revisa paros)
- [ ] Clasificación automática de micro-paros vs paros con causa
- [ ] Integración con CMMS para disparar OT correctiva
- [ ] Threshold de micro-paros configurable
- [ ] ~Esto ya estaba diseñado, se perdió en branch local~

### Sprint B: "Conexión con Epicor" (cuando IT dé la API)
- [ ] Recepción de órdenes de producción desde Epicor
- [ ] Post-back de cierre de turno (producción real, consumo materiales)
- [ ] Envío de lotes para trazabilidad en Epicor

### Sprint C: "Dashboard + Reportes"
- [ ] Dashboard modo TV para piso de planta
- [ ] Vista OEE por línea/turno con tendencias
- [ ] KPIs: MTBF, MTTR, scrap rate
- [ ] Reportes automáticos exportables
- [ ] Dashboard PowerBI (link existente en settings)

### Sprint D: "Alertas y Andon"
- [ ] Alertas por umbral (OEE bajo, paro prolongado)
- [ ] Notificaciones WhatsApp/SMS/email
- [ ] Health check endpoint

### Sprint E: "IoT Gateway" (cuando llegue el hardware)
- [ ] Monitoreo de sensores en tiempo real
- [ ] Detección automática de paros
- [ ] Variables de proceso (temp, vibración, etc.)

---

## Notas de Arquitectura

- **Offline-first obligatorio**: Todo debe funcionar sin conexión y sincronizar cuando regrese.
- **Deploy**: GitHub Actions corre E2E → si pasa, deploy a Vercel. Nhost auto-deploy desde el mismo push.
- **No hay costo por máquina/mes**: Solo infraestructura (Nhost + Vercel).
- **Competencia con Pulsar**: No competimos en automatic data capture (hardware). Competimos en costo + integración CMMS/Epicor + industria específica chocolate + ISO 22000.
