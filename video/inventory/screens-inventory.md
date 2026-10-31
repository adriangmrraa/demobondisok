# Inventario de pantallas reales

Fuente única: `https://demobondisok-ten.vercel.app`, relevada el 31 de octubre de 2026 con Chromium headless, viewport `390x844`, `deviceScaleFactor: 2`, touch, `es-AR`, zona `America/Argentina/Cordoba` y geolocalización `-34.6063,-58.4352` (Parque Centenario). Las capturas de este inventario están en `video/inventory/shots/`.

## Resultado que condiciona el guion

- La raíz redirige a `/inicio`.
- La aplicación no escribió nada en `localStorage` ni `sessionStorage` durante el recorrido relevado.
- Volver a `/inicio` después de abrir y consultar un viaje mostró la misma estructura y los mismos accesos que la primera visita. No hay un estado personalizado verificable para un “usuario recurrente”.
- Sí existe un bloque real y siempre visible llamado **“Historial de paradas”**. El guion puede explicar ese acceso directo, pero no puede afirmar que se genera o cambia por el uso.
- El trayecto completo desde una tarjeta de “Historial de paradas” hasta el mapa requiere **3 taps** en la versión desplegada: tarjeta, opción de viaje y “Ver el recorrido en el mapa”. No se verificaron tres accesos distintos de 1 o 2 taps que terminen con un viaje ya elegido.
- “Modo Viaje” se abre con doble toque sobre **En vivo**. Es una interacción real declarada por el enlace (`aria-label="Ir al mapa en vivo. Doble toque para abrir Modo Viaje"`).

## Rutas y estados

### `/inicio` — inicio, primera llegada y regreso

Acceso: navegación a `/` y redirección automática (0 taps). Capturas: `recon-home.png`, `recon-home-after-trip.png`.

Texto visible verificado:

- `Hola 👋`
- `Sábado, 31 De Octubre`
- `Planificá tu viaje`
- `¿Cómo querés buscar?`
- `Buscar línea` / `Ej. 65`
- `Paradas cerca` / `Usar mi ubicación`
- `¿A dónde vas?` / `Planear un viaje`
- `Explorar mapa` / `Ver la red`
- `Historial de paradas`
- `Alertas` / `Ver todas`
- `Demora en la línea 194`
- `Línea 194: Servicio con demoras por obras en el corredor Panamericana. Tiempos de espera más largos en ambos sentidos.`
- Navegación: `Red Metropol`, `¿Cómo llego?`, `En vivo`, `Diagrama`, `Inicio`.

Datos reales visibles:

- Línea `65`: `Parque Centenario / Hospital Durand` → `Barrancas de Belgrano (Cabecera Norte)`, `3 min`, `en vivo`.
- Línea `65`: `Plaza Constitución (Cabecera Sur)` → `Barrancas de Belgrano (Cabecera Norte)`, `En parada`, `en vivo`.
- Línea `194`: `Terminal Once (Plaza Miserere)` → `Estación Escobar (Terminal 194)`, `RETRASO`, `En parada`, `en vivo`.
- Línea `194`: `Terminal Once (Plaza Miserere)` → `Centro de Transferencia de Zárate`, `RETRASO`, `En parada`, `en vivo`.

Coordenadas verificadas en viewport CSS `390x844`:

| Acción | Centro del tap | Taps desde inicio | Resultado |
| --- | ---: | ---: | --- |
| `Buscar línea` | `(103,272)` | 1 | hoja de búsqueda sobre `/inicio` |
| `Paradas cerca` | `(287,272)` | 1 | `/como-llego` |
| `¿A dónde vas?` | `(103,390)` | 1 | `/como-llego` |
| `Explorar mapa` | `(287,390)` | 1 | `/mapas` |
| primer historial 65 | `(195,543)` | 1 | `/viaje?...` |
| alerta 194 | `(195,639)` después de scroll | 1 | `/alerta/alert-194-002` |
| `Diagrama` en dock | `(265,788)` | 1 | `/diagrama` |
| doble toque `En vivo` | centro aproximado `(195,788)` | 2 taps | abre Modo Viaje sobre `/mapas` |

### Hoja “Buscar por línea” sobre `/inicio`

Acceso: `Buscar línea` (1 tap). Captura: `recon-line-lookup.png`.

Texto y datos visibles:

- `Buscar por línea`
- `Escribí el número o el nombre para abrir su diagrama.`
- `65` — `Línea 65` — `Troncal Constitución – Barrancas de Belgrano` — `Ver diagrama`
- `194` — `Línea 194` — `Once ⇄ Zárate (Común x RP 6)` — `Ver diagrama`
- También aparecen las líneas `109`, `136`, `151`, `163`, `176`, `181`, `182`, `195` y `365`, cada una con su nombre real y `Ver diagrama`.

### `/como-llego` — planificador

Acceso: `¿A dónde vas?` o `Paradas cerca` (1 tap). Capturas: `recon-plan-trip.png`, `recon-nearby.png`.

Texto visible:

- `¿Cómo llego?`
- `Planificá tu viaje de A a B`
- `Usar mi ubicación`
- `Buscar cómo llegar`
- `DESTINOS DESTACADOS`
- `LÍNEAS DISPONIBLES`

Datos visibles:

- `Plaza Constitución` — `Constitución, CABA`
- `Barrancas de Belgrano` — `Belgrano, CABA`
- `Terminal Once` — `Plaza Miserere, CABA`
- `Estación Escobar` — `Belén de Escobar`
- `Campana Centro` — `Campana, GBA Norte`
- `Centro de Transferencia de Zárate` — `Zárate, GBA Norte`
- Línea `65`: `Plaza Constitución → Barrancas de Belgrano`, `La Nueva Metropol`.
- Línea `194`: `Plaza Miserere → Zárate`, `La Nueva Metropol`.

### `/viaje?...` — elección y detalle del viaje

Acceso: primer historial 65 `(195,543)` (1 tap). Capturas: `recon-trip-options.png`, `recon-trip-map-selected.png`.

Estado de elección:

- `TU VIAJE`
- `Parque Centenario / Hospital Durand → Barrancas de Belgrano (Cabecera Norte)`
- `Elegí cómo viajar`
- `Compará las opciones antes de abrir el mapa.`
- `10 min`
- `Directo · Línea 65 (Troncal)`
- `65`
- `Directo · 0 min a pie`

Tap verificado: opción `Directo · Línea 65 (Troncal)` en `(195,274)`; segundo tap desde inicio.

Estado de detalle tras elegir:

- `TU PRÓXIMO COLECTIVO`
- `Línea 65`
- `Sin seguimiento en vivo`
- `Hacia Troncal Constitución – Barrancas de Belgrano`
- `Esperalo en la parada indicada y seguí los pasos.`
- `Paso a paso`
- `10 min` / `4 paradas`
- `Ver en el mapa`
- `Recorrido`
- Paradas: `Parque Centenario / Hospital Durand`, `Hospital Naval`, `Av. Corrientes y Scalabrini Ortiz`, `Chacarita / Estación Federico Lacroze`, `Barrancas de Belgrano (Cabecera Norte)`.
- `Ver el recorrido en el mapa`.

Tap verificado: `Ver el recorrido en el mapa` en `(195,796)` después de scroll; tercer tap desde inicio.

### `/mapas` — mapa sin selección

Acceso: `Explorar mapa` (1 tap). Captura: `recon-explore-map.png`.

Texto y controles reales:

- `¿A dónde vas?`
- `Buscá calles, lugares o paradas`
- `Viaje`
- `Elegí una línea para ver su recorrido y sus unidades en vivo.`
- Botón con `aria-label="Ver lista de líneas disponibles"` en `(36,104)`.
- Controles de zoom, norte, tema, centrar y posición simulada.
- Mapa CARTO/OpenStreetMap con tiles visibles; la captura no está gris ni vacía.

### `/mapas?trip=1&...` — viaje elegido sobre el mapa

Acceso: historial 65 → opción directa → `Ver el recorrido en el mapa` (3 taps). Captura: `recon-map-route.png`.

Texto y datos visibles:

- `Parque Centenario / Hospital Durand → Barrancas de Belgrano (Cabecera Norte)`
- `TU COLECTIVO`
- `Línea 65`
- `Llega en 3 min`
- `1 alternativa`
- `Opciones` / `Pasos`
- `EN TU PARADA · 3 OPCIONES`
- Línea `65`: `Plaza Constitución → Barrancas de Belgrano`, `3 min`, `5 min`, `8 min`.
- `~10 min · directo`
- `Directo · Línea 65 (Troncal)`
- `0 m a pie`
- `Ver pasos`

Verificación visual: tiles cargados, ruta coloreada, parada seleccionada y encuadre cercano visibles.

### Modo Viaje sobre `/mapas`

Acceso: doble toque en `En vivo` del dock (2 taps). Capturas: `recon-mode-trip-entry.png`, `recon-mode-trip-planned.png`.

Estado inicial:

- `MODO VIAJE`
- `¿Desde dónde?` — `Parque Centenario` — `Cambiar`
- `¿A dónde vas?` — `Elegí tu destino` — `Escribir`
- `Lugares:`
- `Manuel de la Torre y Av. Anta`
- `Av. Caseros y Bernardo de Irigoyen`
- `Parque Centenario`
- `Hospital Durand`
- `Plaza Constitución`
- `Elegí tu destino para calcular el viaje`
- `Podés escribir una dirección o tocar "En mapa" para fijar un punto directamente.`

Estado calculado al elegir `Plaza Constitución`:

- `Parque Centenario → Plaza Constitución`
- `TU COLECTIVO`
- `Línea 151`
- `En parada`
- `2 alternativas`
- `EN TU PARADA · 3 OPCIONES`
- Línea `151`: `Constitución → Barrancas`, `En parada`, `6 min`, `11 min`.
- `~22 min · directo`, `Directo · Línea 151 (Troncal)`, `1278 m a pie`.
- `~26 min · 1 combinación`, `Combinación · 65 (Troncal) ➔ 65 (Troncal) (en Chacarita / Estación Federico Lacroze)`, `84 m a pie`.

### `/diagrama` — red, líneas, ramales y combinaciones

Acceso: `Diagrama` en dock (1 tap). Captura: `recon-diagram.png`.

Texto verificado:

- `Diagrama`
- `11 líneas operativas · red Metropol AMBA`
- `Cómo leer el plano`
- `Cada trazo de color es una línea. Los puntos grandes son cabeceras, las pastillas blancas marcan paradas con combinación (los chips bajo el nombre dicen con qué) y la pastilla doble es la estación donde se cruzan las líneas. Tocá un trazo para ver su recorrido completo.`
- Leyenda: `Cabecera`, `Parada`, `Combinación`, `Intercambio`.
- `Líneas de la red` / `11 OPERATIVAS`.
- Línea `65`: `Plaza Constitución → Barrancas de Belgrano`, `1 ramal`, `18.0 km`, `cada 5 min`, `24 coches`, `1 ALERTA ACTIVA`.
- Línea `194`: `Plaza Miserere (Once) → Centro de Transferencia de Zárate`, `8 ramales`, `92.4 km`, `cada 5 min`, `30 coches`, `2 ALERTAS ACTIVAS`.

### `/alerta/alert-194-002` — informe real de servicio

Acceso: alerta del inicio (1 tap después de scroll). Captura: `recon-alert-detail.png`.

Texto y datos verificados:

- `Informe de servicio`
- `Activo`
- `Retraso en el servicio`
- `Demora en la línea 194`
- `Inicio: 09:30 hs`
- `Línea 194 — Plaza Miserere – Zárate / Escobar`
- `Once ⇄ Zárate (Común x RP 6) · cada 5 min`
- `QUÉ ESTÁ PASANDO`
- `TRAMOS AFECTADOS`
- `ALTERNATIVAS · COMBINÁ CON`
- `CRONOLOGÍA`
- `Ver en el mapa`
- `Ver la línea`

## Evidencia visual revisada en G1

Se abrieron y miraron a resolución original: `recon-home.png`, `recon-explore-map.png`, `recon-map-route.png` y `recon-mode-trip-entry.png`. En ambos estados de mapa se verificaron tiles reales; el mapa seleccionado muestra ruta y parada, y Modo Viaje muestra origen y selector de destino reales.
