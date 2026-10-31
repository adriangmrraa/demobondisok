# Guion — Demobondis explicativo vertical

Duración objetivo: **213 s (3:33)**. Ritmo de lectura validado con un máximo de 2,2 palabras por segundo. Video silencioso: el texto en pantalla carga toda la explicación.

| Escena | Tiempo | Duración | Kicker | Texto en pantalla (máx. 3 líneas) | UI real a la que refiere | Interacción real grabada |
| --- | --- | ---: | --- | --- | --- | --- |
| 01 | 00:00–00:10 | 10 s | DEMOBONDIS | `Una persona abre la app.`<br>`Todo empieza en el viaje real.` | `/inicio`: `Planificá tu viaje`; tarjetas `Buscar línea`, `Paradas cerca`, `¿A dónde vas?`, `Explorar mapa`. | Apertura del URL raíz y redirección real a `/inicio`. |
| 02 | 00:10–00:28 | 18 s | QUÉ ES | `Es un producto funcionando.`<br>`Inicio, viajes y red en vivo.` | Dock real: `Inicio`, `¿Cómo llego?`, `En vivo`, `Diagrama`, `Red Metropol`; inicio real con datos de líneas. | Scroll suave del inicio desde planificación hasta `Historial de paradas` y `Alertas`. |
| 03 | 00:28–00:58 | 30 s | PRIMERA LLEGADA | `Cuatro caminos desde el inicio.`<br>`Buscar, planificar o ver la red.`<br>`El historial queda a la vista.` | Encabezado real `¿Cómo querés buscar?`; cuatro tarjetas; bloque real `Historial de paradas`. | Pulsos sobre las cuatro tarjetas sin navegar; scroll hasta las tarjetas 65/194 del historial. |
| 04 | 00:58–01:23 | 25 s | AL VOLVER | `No inventa preferencias.`<br>`Mantiene los accesos directos.`<br>`El historial siempre está visible.` | G1 verificó `localStorage` y `sessionStorage` vacíos; `/inicio` después de consultar un viaje mantiene la misma estructura; `Historial de paradas` permanece visible. | Abrir historial 65, volver a `/inicio` y mostrar el mismo bloque de accesos e historial. |
| 05 | 01:23–01:58 | 35 s | LLEGAR AL MAPA | `Mapa libre: un toque.`<br>`Modo Viaje: doble toque.`<br>`Recorrido elegido: tres.` | `Explorar mapa` → `/mapas`; `aria-label` real de `En vivo`: doble toque para abrir Modo Viaje; historial 65 → opción directa → `Ver el recorrido en el mapa`. | Tres secuencias reales con indicador de dedo: explorar mapa (1), doble toque en `En vivo` (2), historial 65 + opción + mapa (3). |
| 06 | 01:58–02:36 | 38 s | EL MAPA | `Líneas, ramales y paradas.`<br>`La ruta elegida queda marcada.`<br>`El encuadre sigue ese recorrido.` | `/diagrama`: leyenda `Cabecera`, `Parada`, `Combinación`, `Intercambio`; línea 65 `1 ramal`; línea 194 `8 ramales`. `/mapas?trip=1`: ruta y parada seleccionada visibles. | Abrir selector de líneas, mostrar red/diagrama y terminar en el mapa del viaje 65 con tiles, ruta, paradas y panel de opciones. |
| 07 | 02:36–03:11 | 35 s | MODO VIAJE | `Origen, destino y opciones reales.`<br>`Compara tiempo, caminata y combinaciones.`<br>`Después muestra cada paso.` | Modo Viaje real: `¿Desde dónde?`, `¿A dónde vas?`, `Opciones`, `Pasos`; opciones con `1278 m a pie` y `1 combinación`. | Doble toque en `En vivo`, elegir `Plaza Constitución`, abrir `Opciones` y `Pasos`; mapa con ruta calculada. |
| 08 | 03:11–03:33 | 22 s | YA ESTÁ FUNCIONANDO | `Está construido y desplegado.`<br>`demobondisok-ten.vercel.app`<br>`Listo para probar en producción.` | URL real abierta y operativa; `/inicio`, `/mapas`, `/viaje`, `/diagrama` e informe de alerta verificados en G1. | Recorrido final por inicio, mapa real con tiles y URL visible en el cierre. |

## Trazabilidad y límites editoriales

- El guion no usa la palabra “recurrente” como función del producto: G1 no encontró personalización ni persistencia de visita. La escena 04 muestra honestamente que la pantalla vuelve al mismo estado y que el historial es siempre visible.
- La escena 05 no afirma tres entradas de 1 o 2 taps hacia un viaje ya elegido porque la aplicación desplegada no las ofrece. Muestra los conteos reales: 1 tap al mapa libre, 2 taps para Modo Viaje y 3 taps para el recorrido elegido.
- Los tiempos `3 min`, `5 min` y `8 min` son datos dinámicos; las capturas usarán el valor realmente visible en ese momento y el texto editorial no fijará un número.
- No se usa audio, música, voz, imágenes de stock ni pantallas recreadas.
