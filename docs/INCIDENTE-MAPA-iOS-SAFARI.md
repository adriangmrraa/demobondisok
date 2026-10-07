# Incidente: el mapa no se ve en iPhone (Safari / WebKit)

**Estado:** RESUELTO — fix aplicado y verificado en WebKit (2026-10-07). Pendiente solo la confirmación en un iPhone físico del cliente.
**Severidad original:** Alta (bloqueaba el uso del demo en iPhone).
**Fecha de investigación:** 2026-09-26. **Fecha de resolución:** 2026-10-07.

---

## 1. Resumen

En el demo desplegado, la pantalla `/mapas` **renderiza bien en desktop (Chrome), Android y en la emulación móvil del navegador desde la PC**, pero **en un iPhone real con Safari el mapa aparecía en blanco**: se veía el chrome de la UI (barra de búsqueda, controles de zoom, brújula, escala, bottom nav) pero **no se pintaban los tiles del basemap** ni los colectivos, rutas o paradas.

## 2. Dispositivo afectado

| Dato | Valor |
|------|-------|
| Dispositivo | iPhone 11 |
| iOS | **18.7.2** |
| Navegador | Safari (motor WebKit) |
| Dónde SÍ funciona | Desktop (Chrome), Android, emulación móvil (DevTools) desde PC |
| Dónde NO funcionaba | iPhone real (WebKit) |

> iOS 18.7.2 soporta `100dvh`, module workers (ESM), WebGL2 y `OffscreenCanvas`. **No era un problema de APIs faltantes ni de navegador viejo.**

## 3. Síntoma exacto

- El `<canvas>` de MapLibre se crea con tamaño correcto (ej. 828×1430 device px para 414×715 CSS px, `devicePixelRatio = 2`).
- El contexto WebGL2 se crea OK y **no se pierde** (`isContextLost() === false`, `glError === 0`).
- Tamaño de contenedor, canvas, `drawingBuffer` y `VIEWPORT` eran correctos e idénticos a un mapa que SÍ renderiza.
- El canvas mostraba **solo el color de fondo del estilo**; tras forzar `setStyle` al CARTO limpio aparecía apenas una franja fina de tiles en la esquina superior izquierda.
- El worker de MapLibre **estaba vivo y ejecutó su módulo** (`self.worker`, `self.worker.actor`, `registerWorkerSource` presentes).

## 4. Investigación (reproducido con WebKit real vía Playwright, emulación iPhone 11)

Se levantó un **build de producción** local y se abrió con Playwright `webkit`.

| Prueba | Resultado |
|--------|-----------|
| Mapa **MapLibre v6 mínimo** (mismo WebKit, estilo CARTO, sin código de la app) | **Renderiza perfecto** (`styleLoaded/loaded/tilesLoaded = true`) |
| Mapa mínimo con **las MISMAS opciones de la app** (`maxPitch`, `bearingSnap`, `dragPan`, `touchZoomRotate`, `attributionControl`) | **Renderiza perfecto** → **las opciones NO son la causa** |
| Mapa de la app en WebKit | En blanco; `styleLoaded` intermitente |
| Mismo módulo MapLibre standalone creado DENTRO de la página de la app | Falla |
| Reemplazar el estilo por CARTO limpio (borra capas/sources de la app) | Seguía casi en blanco (solo una franja) |
| **RAF globales limitados a ~12 fps** | Hace cargar el mapa **limpio**… **pero el mapa DE LA APP seguía fallando** → **la contención por frames NO es la causa raíz** |
| `gl.isContextLost()`, `glError` | OK (no se pierde el contexto) |

**Conclusión de la evidencia:** MapLibre v6 + WebKit funciona bien por sí solo. El fallo era **específico de la instancia de mapa de la app**, y **NO** dependía de: soporte de APIs, tamaño/DPR del canvas, pérdida de contexto, versión del worker, MIME, opciones de creación, ni del flood de RAF.

## 5. Causa raíz (CONFIRMADA)

**Compositing de capas en WebKit.** Un `transform: translateZ(0)` en el header flotante superior —hermano del contenedor del canvas dentro de `<main>`— promovía ese subtree a capa de composición GPU y, en WebKit (Safari iOS y cualquier WKWebView), culminaba la capa del canvas en el plano 3D coplanar: **el canvas se pintaba en negro**. Blink (Chrome desktop / Android) tolera el patrón, por eso el bug era iOS-only.

- **Línea culpable:** `src/app/mapas/page.tsx` (era `style={{ transform: "translateZ(0)" }}` en el header).
- El propio código documentaba el patrón peligroso en el comentario de `src/components/map/MapCanvas.tsx` (contenedor del canvas: "si el padre lleva `transform: translateZ(0)` + `will-change` + `backface-visibility`, WebKit culla la capa del canvas y NO la pinta").
- Hipótesis descartadas durante la investigación: versiones de MapLibre, worker, MIME, viewport/DPR, pérdida de contexto, opciones del mapa, contención por `requestAnimationFrame`, `installOverlays()` como causa primaria.

## 6. Fix (aplicado)

**Commit `c0871ea` — `fix(mapas): quitar translateZ(0) del header para destrabar el canvas en iOS Safari`** (2026-10-07 09:55 -0300), rama `fix/iphone-safari-and-design-system`.

Cambio: se eliminó `style={{ transform: "translateZ(0)" }}` del header flotante de `/mapas` (queda documentado con comentario inline). Es un patrón legacy anti-flicker; sin él el header sigue funcionando igual. Si en algún momento hiciera falta aislarlo, el fallback correcto es `isolation: isolate` (stacking context sin promover capa GPU con transform).

## 7. Verificación (cómo se comprobó)

Protocolo executado el 2026-10-07 con **WebKit real** (Playwright WebKit 26.6, emulación iPhone 11: 414×715 CSS, DPR 2 → canvas 828×1430, idéntico al síntoma original), contra **producción** (`https://demobondisok-ten.vercel.app`):

1. **Script:** `scripts/verify-map-webkit.mjs <url> <salida.png>` (queda en el repo como herramienta de regresión).
2. **`/mapas` (estado inicial):** tiles del basemap renderizados (Zárate, Campana, Vicente López, CABA…), header y bottom nav OK, `hasInlineTranslate: false`.
3. **Zoom interactivo (4×):** tiles correctos en z13, sin pérdida de contexto.
4. **`/mapas?trip=1…&linea=line-65` (trip mode):** ruta resaltada dibujada, parada labelada, alerta "ARRIBANDO · Línea 65" y ETAs de colectivos en vivo (Coche 18 "En parada", Coche 101 "3 min") — overlays y datos, no solo basemap.
5. **Regresión desktop (Chromium):** `/mapas` renderiza idéntico al previo al fix, 0 errores de consola.
6. **Fallo esperado en carga de tiles:** los `Load request cancelled` de `tiles-*.cartocdn.com` son cortes de requests viejos al cambiar de zoom/cerrar el browser, no fallas reales (las capturas muestran tiles completos).

**Caveat honesto:** WebKit de Playwright es el mismo motor que Safari iOS pero **no es un iPhone físico** (GPU/compositor del dispositivo pueden diferir). La confirmación final es abrir `/mapas` en el iPhone 11 del cliente: debe verse el mapa con tiles.

### Cómo re-verificar cualquier cambio futuro

1. `node scripts/verify-map-webkit.mjs "https://<producción>/mapas" salida.png` — esperar tiles.
2. Repetir con URL de trip (`?trip=1&origen=…&linea=line-65&paradaSubida=stop-65-01`) — esperar ruta/paradas/ETAs.
3. Captura desktop (Chromium) — confirmar sin regresión.
4. Siempre: prueba final en iPhone real del cliente.
