# Procedimiento de Sync Engram ↔ Cloud (Supabase CMMS)

> **ÚLTIMA ACTUALIZACIÓN:** 2026-05-18  
> **AUTOR:** Open Code (auto-generado tras investigación)  
> **PROYECTO:** produccion-ibarra  

---

## 📋 Resumen Ejecutivo

Este documento establece el procedimiento EXACTO y REPETIBLE para sincronizar las memorias persistentes de Engram (almacenadas localmente en SQLite) con la base de datos cloud de Supabase del proyecto CMMS. **Nunca más adivinar.**

---

## 🔧 Requisitos Previos

1. **Engram CLI instalado** en:  
   `C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe`

2. **Configuración cloud activa** (verificada con `engram cloud status`):
   - Server: `http://127.0.0.1:8080`
   - Auth: token configurado vía runtime cloud config
   - Estado: `ready for explicit --project sync`

3. **Servidor cloud de Engram corriendo** en puerto 8080

---

## 🚀 Procedimiento Paso a Paso

### Paso 1: Verificar estado del servidor cloud

```powershell
# Verificar si el servidor está corriendo
netstat -ano | findstr 8080
```

**Si NO hay resultado** (puerto 8080 vacío), ir al Paso 2.  
**Si SÍ hay resultado** (LISTENING en 8080), ir al Paso 3.

---

### Paso 2: Levantar servidor cloud de Engram

```powershell
# Método A: Ventana visible (para debug)
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" cloud serve

# Método B: Background (producción)
Start-Process -FilePath "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" `
  -ArgumentList "cloud", "serve" `
  -WindowStyle Hidden

# Verificar después de 5-10 segundos
netstat -ano | findstr 8080
```

**Nota:** El servidor cloud de Engram (`engram cloud serve`) expone un backend HTTP en `127.0.0.1:8080` que se conecta a Supabase como almacenamiento persistente de las memorias.

---

### Paso 3: Verificar proyectos enrolados

```powershell
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" cloud status
```

**Salida esperada:**
```
Cloud status: configured (target=cloud)
Server: http://127.0.0.1:8080
Auth status: ready (token provided via runtime cloud config)
Sync readiness: ready for explicit --project sync (project must be enrolled)
```

---

### Paso 4: Ejecutar sync por proyecto

```powershell
# Sync del proyecto produccion-ibarra
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" `
  sync --cloud --project produccion-ibarra

# Sync del proyecto cmms-ibero (si aplica)
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" `
  sync --cloud --project cmms-ibero
```

**IMPORTANTE:** `--all` no está soportado con `--cloud`. Se debe especificar `--project` explícitamente.

**Salida esperada:**
```
Exporting memories for project "produccion-ibarra" to cloud...
Created chunk XXXXXXXX
  Sessions:     N
  Observations: N
  Prompts:      N
  Mutations:    N
Cloud sync complete for project "produccion-ibarra".
```

---

### Paso 5: Verificar estado post-sync

```powershell
# Ver chunks locales vs remotos
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" sync --status
```

**Salida esperada:**
```
Sync status:
  Local chunks:    N
  Remote chunks:   N
  Pending import:  0   ← Debe ser 0 cuando todo está sincronizado
```

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCode Agent (Plugin engram.ts)                          │
│  ├─ Comunica con servidor local engram: 127.0.0.1:7437     │
│  ├─ Guarda memoria vía HTTP calls                            │
│  └─ SQLite local como almacenamiento primario              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP API (puerto 7437)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Engram Local Server (`engram serve`)                       │
│  ├─ Base de datos SQLite local                              │
│  ├─ Expone API HTTP para lectura/escritura                  │
│  └─ Sync automático con .engram/ en el repo                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ `engram sync --cloud --project X`
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Engram Cloud Server (`engram cloud serve`)                   │
│  ├─ Corre en: 127.0.0.1:8080                                │
│  ├─ Conecta con Supabase (proyecto CMMS)                      │
│  └─ Materializa mutaciones en PostgreSQL                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Conexión persistente a Supabase
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Supabase (proyecto CMMS)                                     │
│  └─ Tablas: sessions, observations, prompts, chunks, etc.   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `dial tcp 127.0.0.1:8080: connectex: No connection could be made` | Servidor cloud no está corriendo | Ejecutar `engram cloud serve` (ver Paso 2) |
| `cloud sync requires a single explicit --project scope; --all is not supported` | Usando `--all` con `--cloud` | Especificar `--project NOMBRE_DEL_PROYECTO` |
| `Server NOT running on port 8080` | El servidor cloud murió o no arrancó | Verificar procesos con `Get-Process \| Where-Object { $_.ProcessName -like "*engram*" }` |
| `Pending import: N` (N > 0) | Hay chunks locales no sincronizados | Ejecutar sync explícito para cada proyecto |
| Múltiples procesos engram | Sesiones anteriores no cerradas | Matar procesos viejos: `Get-Process \| Where-Object { $_.ProcessName -like "*engram*" } \| Stop-Process` |

---

## ⚡ Comandos Rápidos (Copiar y Pegar)

### Verificar y levantar servidor:
```powershell
# 1. Check servidor
$portCheck = netstat -ano | Select-String "8080"; if (-not $portCheck) { Write-Output "Servidor NO corriendo. Levantando..."; Start-Process -FilePath "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" -ArgumentList "cloud", "serve" -WindowStyle Hidden; Start-Sleep 10 } else { Write-Output "Servidor ya corriendo en 8080" }

# 2. Sync produccion-ibarra
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" sync --cloud --project produccion-ibarra

# 3. Verificar estado
& "C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe" sync --status
```

---

## 📝 Notas Críticas

1. **NO MODIFICAR la base de datos de CMMS directamente.** El sync es unidireccional: local → cloud. Engram maneja las mutaciones automáticamente.

2. **El servidor cloud (`engram cloud serve`) debe permanecer activo** durante todo el sync. Si se cierra, el sync fallará.

3. **Cada proyecto debe enrolarse explícitamente.** Verificar con `engram cloud status` que el proyecto esté listo para sync.

4. **Las memorias locales (SQLite) son la fuente de verdad.** El cloud es un backup replicado. Si hay conflictos, Engram resuelve las mutaciones automáticamente.

5. **Después de compaction:** Siempre ejecutar sync para preservar las memorias de la sesión compactada.

---

## 🔄 Checklist de Cierre de Sesión

- [ ] Hotfixes aplicados y commiteados
- [ ] Push a `origin/main` completado
- [ ] `mem_session_summary` guardado en Engram local
- [ ] Servidor cloud de Engram verificado/levantado (`netstat -ano | findstr 8080`)
- [ ] Sync ejecutado: `engram sync --cloud --project produccion-ibarra`
- [ ] Sync status verificado: `Pending import: 0`
- [ ] Archivo declarativo actualizado si el procedimiento cambió

---

## 📎 Referencias

- **Engram CLI:** `C:\Users\Ismael.Cruz\AppData\Local\engram\bin\engram.exe`
- **Plugin OpenCode:** `C:\Users\Ismael.Cruz\.config\opencode\plugins\engram.ts`
- **Convenciones:** `C:\Users\Ismael.Cruz\.config\opencode\skills\_shared\engram-convention.md`
- **Backup local:** `engram-backup-20260506-162057.json` (en raíz del repo)
- **Supabase proyecto:** CMMS (configurado en runtime cloud config de Engram)
