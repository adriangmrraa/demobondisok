# Incidente: el mapa no se ve en iPhone (Safari / WebKit)

**Estado:** ABIERTO — SIN RESOLVER. **No hay fix aplicado ni verificado.**
**Severidad:** Alta (bloquea el uso del demo en iPhone).
**Fecha de investigación:** 2026-09-26.

---

## 1. Resumen

En el demo desplegado, la pantalla `/mapas` **renderiza bien en desktop (Chrome), Android y en la emulación móvil del navegador desde la PC**, pero **en un iPhone real con Safari el mapa aparece en blanco**: se ve el chrome de la UI (barra de búsqueda, controles de zoom, brújula, escala, bottom nav) pero **no se pintan los tiles del basemap** ni los colectivos, rutas o paradas.

## 2. Dispositivo afectado

| Dato | Valor |
|------|-------|
| Dispositivo | iPhone 11 |
| iOS | **18.7.2** |
| Navegador | Safari (motor WebKit) |
| Dónde SÍ funciona | Desktop (Chrome), Android, emulación móvil (DevTools) desde PC |
| Dónde NO funciona | iPhone real (WebKit) |

> iOS 18.7.2 soporta `100dvh`, module workers (ESM), WebGL2 y `OffscreenCanvas`. **No es un problema de APIs faltantes ni de navegador viejo.**

## 3. Síntoma exacto

- El `<canvas>` de MapLibre se crea con tamaño correcto (ej. 828×1430 device px para 414×715 CSS px, `devicePixelRatio = 2`).
- El contexto WebGL2 se crea OK y **no se pierde** (`isContextLost() === false`, `glError === 0`).
- Tamaño de contenedor, canvas, `drawingBuffer` y `VIEWPORT` son correctos e idénticos a un mapa que SÍ renderiza.
- El canvas muestra **solo el color de fondo del estilo**; tras forzar `setStyle` al CARTO limpio aparece apenas una franja fina de tiles en la esquina superior izquierda.
- El worker de MapLibre **está vivo y ejecutó su módulo** (`self.worker`, `self.worker.actor`, `registerWorkerSource` presentes).

## 4. Investigación (reproducido con WebKit real vía Playwright, emulación iPhone 11)

Se levantó un **build de producción** local y se abrió con Playwright `webkit`.

| Prueba | Resultado |
|--------|-----------|
| Mapa **MapLibre v6 mínimo** (mismo WebKit, estilo CARTO, sin código de la app) | **Renderiza perfecto** (`styleLoaded/loaded/tilesLoaded = true`) |
| Mapa mínimo con **las MISMAS opciones de la app** (`maxPitch`, `bearingSnap`, `dragPan`, `touchZoomRotate`, `attributionControl`) | **Renderiza perfecto** → **las opciones NO son la causa** |
| Mapa de la app en WebKit | En blanco; `styleLoaded` intermitente |
| Mismo módulo MapLibre standalone creado DENTRO de la página de la app | Falla |
| Reemplazar el estilo por CARTO limpio (borra capas/sources de la app) | Sigue casi en blanco (solo una franja) |
| **RAF globales limitados a ~12 fps** | Hace cargar el mapa **limpio**… **pero el mapa DE LA APP sigue fallando** → **la contención por frames NO es la causa raíz** |
| `gl.isContextLost()`, `glError` | OK (no se pierde el contexto) |

**Conclusión de la evidencia:** MapLibre v6 + WebKit funciona bien por sí solo. El fallo es **específico de la instancia de mapa de la app** (algo que la app le agrega/configura), y **NO** depende de: soporte de APIs, tamaño/DPR del canvas, pérdida de contexto, versión del worker, MIME, opciones de creación, ni del flood de RAF.

## 5. Causa raíz

**NO CONFIRMADA.** Hipótesis descartadas: versiones de MapLibre, worker, MIME, viewport/DPR, pérdida de contexto, opciones del mapa, contención por `requestAnimationFrame`.

**Sospechas vigentes (a bisecar):**
1. `installOverlays()`: las fuentes/capas/imágenes custom que la app agrega (sprites rasterizados con `addImage`, capas `fill-extrusion`/symbol, GeoJSON pesados). El `setStyle(clean)` mejoró pero no arregló del todo.
2. Las llamadas manuales a `map.resize()` + `triggerRepaint()` (`refreshCanvasAfterStableLayout`, ResizeObserver) en timing de WebKit.

## 6. Fix

**Pendiente. No aplicado ni verificado.** Próximo paso: bisecar `installOverlays()` y los `map.resize()` en un build de producción contra Playwright WebKit hasta aislar exactamente qué rompe el render, y recién ahí proponer un cambio (que además debe re-verificarse en desktop para no romperlo).

## 7. Cómo verificar cualquier fix

1. `npm ci && npm run build && npm run start`.
2. Abrir `/mapas` en Playwright WebKit con emulación iPhone 11.
3. Confirmar `map.isStyleLoaded() === true`, `map.areTilesLoaded() === true` y que la captura muestre los tiles.
4. Confirmar en desktop que el mapa y la animación siguen igual.
