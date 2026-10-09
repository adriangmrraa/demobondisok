# Home "línea primero": plan de construcción y reordenamiento

> Estado: implementado en la rama `home-feedback` (base `origin/main` @ `4a61f6c`, que ya incluye los PR #1 y #2 de Fabio Arias).
> Alcance: dos variantes del Inicio, cada una con su ruta, construidas a partir de los dos bocetos aprobados por el cliente.

---

## 1. Por qué existe este cambio

Esto salió del feedback de Metropol después de la demo:

- **El 85 % de los pasajeros ya sabe qué colectivo toma y en qué parada.** No quiere planificar un viaje: quiere saber **cuánto falta para que llegue**.
- "Buscar por línea" estaba en la app, pero no se entendía desde el Inicio. Quedaba como una opción más entre cuatro, debajo de un buscador de destino.
- El pedido concreto: **tener a mano todos los números de línea, tocar la tuya y ver enseguida el predictivo de tu parada**.

Por eso se invierte la jerarquía del Inicio:

| Antes (destino primero) | Ahora (línea primero) |
| --- | --- |
| "Planificá tu viaje / ¿A dónde querés ir?" | "Elegí tu línea" con todos los números a la vista |
| 4 accesos con el mismo peso | Línea → parada → próximos arribos en el primer pliegue |
| El ETA aparecía recién en el mapa, 5 o 6 toques después | El ETA está en el Inicio y el mapa queda como acción opcional |

**Escenario de aceptación:**
> "Abrí la app. Tomás el 65 en Parque Centenario. Decime cuándo llega."
> Tiene que poder hacerse sin explicación, sin scroll, sin pedir ubicación y en 1 a 3 toques.

---

## 2. Las dos variantes

| | Variante A: imagen 1 | Variante B: imagen 2 |
| --- | --- | --- |
| Ruta | `/inicio` (la que abre la app; `/` redirige acá) | `/inicio/b` |
| Primer bloque | **Elegí tu línea**: chips + mapa con el tramo de la parada + card de línea y arribos | **Tus últimos viajes** |
| Segundo bloque | CTA **Ver mapa** | **Elegí una línea**, con el link **Ver todas** que despliega la grilla completa |
| Mapa | Preview acotado al entorno de la parada | Grande, con el **recorrido completo** del sentido elegido |
| Card de línea y arribos | Dentro del bloque "Elegí tu línea" | Pegada debajo del mapa |
| CTA "Ver mapa" | Sí | No: el mapa ya ocupa la pantalla y se toca para abrir el mapa en vivo (la franja tachada del boceto) |
| Tus últimos viajes | Después del CTA | Arriba de todo |

**Regla para lo que no aparece en los bocetos:** no se borra nada. Va **debajo del pliegue**, en este orden y en las dos variantes:

1. "Planificá tu viaje" (`AssistantBar`)
2. Los 4 accesos clásicos (`ClassicTripActions`)
3. Alertas

Los overlays (`AssistantWizard`, `LocationConsentModal`, `PlaceSelector`, `AssistantAnswerSheet`, `LineLookupSheet`, `FeatureTour`) quedan **sin cambios**.

---

## 3. Datos: catálogo adaptativo

Hoy conviven dos fuentes:

| Fuente | Contenido | Uso |
| --- | --- | --- |
| `src/data/routes.json` | Líneas **operativas**: recorridos, paradas, flota, GPS simulado. Hoy son 65 y 194 (el PR #2 de Fabio sacó la 60). | Todo lo funcional: mapa, ETAs, planner |
| `src/data/metropol.json` | **Catálogo editorial** de 26 líneas Metropol, scrapeado del sitio. No trae geometría ni paradas. | Diagrama de línea y textos |

`src/lib/home/line-catalog.ts` las combina en un solo catálogo:

- Una línea que está en `routes.json` se marca `operational: true`: el chip queda activo y muestra mapa, card y arribos.
- Una línea que solo está en `metropol.json` se marca `operational: false` y el chip sale atenuado. Al tocarla aparece un aviso: *"La línea 151 todavía no tiene recorrido cargado en la demo"*.
- Orden: primero las operativas y después las del catálogo, en el orden del sitio de Metropol.
- **Se adapta solo.** Cuando se mergee una rama que agregue líneas a `routes.json` (por ejemplo, la de Fabio), esas líneas pasan a funcionar sin tocar el Home. El cruce se hace por número de línea.
- `metropol.json` pesa unos 240 KB. Por eso el catálogo **se arma en el servidor**: los `page.tsx` son Server Components y le pasan al cliente solo `{ id, number, name, color, operational }`. **No importes `line-catalog.ts` desde un componente `'use client'`.**

Las líneas 39, 60 y 68 que aparecían en el boceto **no se muestran**: no son líneas de Metropol, o fueron dadas de baja del dataset.

---

## 4. Arquitectura

```
src/app/inicio/page.tsx          Server: buildLineCatalog() → <HomeScreen variant="a">
src/app/inicio/b/page.tsx        Server: buildLineCatalog() → <HomeScreen variant="b">
src/components/home/HomeScreen.tsx
    Client. Era el antiguo HomePage: conserva TODO su estado (asistente,
    wizard, consentimiento, viajes precargados) y agrega el bloque
    línea primero. Ordena las secciones según `variant`.
src/hooks/use-line-first-selection.ts
    Estado línea / ramal / sentido / parada y sus derivados (arribos,
    frecuencia, URL del mapa).
src/lib/home/line-first.ts       Helpers puros, seguros para el cliente (resolución sobre routes.json)
src/lib/home/line-catalog.ts     Solo servidor: une routes.json y metropol.json
src/lib/home/seeded-routes.ts    Viajes demo: "Tus últimos viajes" y parada por defecto de cada línea
src/components/home/line-first/
    LineChips.tsx          Fila de chips con scroll horizontal, o grilla desplegada
    LinePreviewMap.tsx     DynamicMap no interactivo + overlay que abre /mapas
    LineArrivalsCard.tsx   Línea · parada · sentido + Cambiar dirección + próximos colectivos
    StopPickerSheet.tsx    Elegir ramal y parada (lista tipo diagrama, con buscador)
    RecentTrips.tsx        Tus últimos viajes (2 visibles, "Ver todos" despliega el resto)
    ViewMapCta.tsx         Botón "Ver mapa" (solo en la variante A)
```

### 4.1 Estado (`useLineFirstSelection`)

| Estado | Inicial | Cambia con |
| --- | --- | --- |
| `lineId` | La primera línea operativa (`line-65`) | Tocar un chip operativo |
| `recorridoId` | El recorrido del ramal principal que contiene la parada por defecto | "Cambiar dirección" o elegir otro ramal |
| `stopId` | Origen del primer viaje precargado de esa línea (65 → Parque Centenario; 194 → Once). Si no hay, la parada del medio del recorrido. | Elegir otra en `StopPickerSheet` |

**Valores derivados:**

- `arrivals` = `TransportService.getLlegadasPorParada(stopId, positions)` filtrado por `lineaId` y limitado a 3. Usa **la misma función que el mapa y el planner**, así que no hay un segundo cálculo que pueda divergir.
- `frequencyMin` = `linea.frecuenciaPicoMin`, y de ahí `perHour = round(60 / frequencyMin)`. Alimenta el texto "Pasa cada ~5 min · unos 12 en la próxima hora".
- `mapHref` = `/mapas?linea=<lineId>&ramal=<ramalId>&parada=<stopId>`.

### 4.2 Cambiar dirección

- Pasa al otro recorrido del **mismo ramal** (ida ↔ vuelta).
- **La parada se conserva si existe en el sentido contrario.** En la 194 casi todas se repiten. Si no existe (en la 65 cada sentido tiene paradas propias), se toma **la más cercana geográficamente** del otro sentido. Ejemplo: Parque Centenario (ida) pasa a la parada de vuelta más próxima.
- El botón se deshabilita cuando el ramal tiene un solo recorrido, como los expresos de la 194.

### 4.3 Conexión con el mapa (no se rompe nada)

| Desde el Home | Va a | Contrato |
| --- | --- | --- |
| Tocar el mapa preview / CTA "Ver mapa" | `/mapas?linea=&ramal=&parada=` | Deep link legado que ya existe (`mapas/page.tsx`, effect "Links legacy del home"): filtra la línea y el ramal, abre la burbuja de la parada y sigue la unidad más próxima |
| "Ver diagrama completo" (en `StopPickerSheet`) | `/diagrama/<lineId>` | Ruta existente |
| Card de "Tus últimos viajes" | `/viaje?trip=1&…` | `buildTripJourneyUrl`, sin cambios |
| Accesos clásicos y asistente | Como antes | Sin cambios |

El preview **no** reimplementa el mapa: usa `DynamicMap`/`MapCanvas` con props que ya existen:

- `highlightLines=[recorridoId]` para pintar solo ese sentido.
- `positions` filtradas por línea y ramal.
- `plannerPulse` para el anillo en la parada.
- `focusRequest` para el encuadre.
- `cameraMode="free"`, así el auto-fit del modo `overview` no le pisa el encuadre.

El encuadre se vuelve a pedir en `onMapReady` y cada vez que cambia la línea, el sentido o la parada. Un overlay `<Link>` transparente captura los toques. Los controles de MapLibre se ocultan solo dentro del preview.

**Cambios en `MapCanvas` (los dos opcionales y retrocompatibles; `/mapas` no los usa y se comporta igual que antes):**

- `MapFocusRequest.padding`: padding explícito del `fitBounds`. El de siempre (top 130) está pensado para el header de `/mapas` y en un mapa de 200–300 px corre el recorrido hacia abajo.
- `entryAnimation` (default `true`): con `false`, se saltea la animación de entrada sobre todo el AMBA y la cámara arranca en el `focusRequest` vigente. Sin esto, según el timing de carga, esa animación de 2 s pisaba el encuadre del preview y la variante B quedaba mostrando la provincia (zoom 6) en vez del recorrido.

### 4.4 Bottom nav

`Inicio` queda activo en `/inicio` y también en `/inicio/b`: `pathname.startsWith('/inicio')`.

---

## 5. Textos

Los textos le hablan a alguien que **ya sabe qué colectivo toma**:

| Lugar | Texto |
| --- | --- |
| Encabezado del bloque (A) | **Elegí tu línea** · *Consultá cuándo llega tu colectivo* |
| Encabezado (B) | **Elegí una línea** · Ver todas |
| Card | **Línea 65 · Parque Centenario** · *Constitución → Barrancas de Belgrano* |
| Arribos | **Próximos colectivos en esta parada** · *Pasa cada ~5 min · unos 12 en la próxima hora* |
| Cada arribo | **2 min** / **Arribando** / **En parada**, con *En recorrido* (unidad con GPS) o *Estimado* (completado con la frecuencia programada) |
| Línea sin datos | *La línea 151 todavía no tiene recorrido cargado en la demo. Probá con la 65 o la 194.* |

**Honestidad del dato:** las filas sintéticas (`simulated: true`) dicen "Estimado" y no "En recorrido". La demo no presenta como real algo que no lo es.

---

## 6. Riesgos y decisiones abiertas

1. **Cobertura de líneas.** El catálogo muestra 26 números, pero solo 2 funcionan. Es una decisión comercial: mostrar la red completa como "en preparación". Si el cliente prefiere ver solo las operativas, se cambia **una línea** en `buildLineCatalog` (filtrar por `operational`).
2. **Mapa en el primer pliegue.** MapLibre se carga apenas se abre el Inicio. Hay que validarlo en un iPhone real (ver `docs/INCIDENTE-MAPA-iOS-SAFARI.md`). Si falla, `DynamicMap` muestra su fallback y el resto del Home sigue funcionando.
3. **Franja tachada de la imagen 2.** Se interpretó como "sin CTA Ver mapa". A confirmar con el cliente.
4. **"Tus últimos viajes" no es historial real.** Son los 4 viajes precargados de siempre. Un historial verdadero necesita persistencia, que queda fuera de este alcance.
5. **La dirección de las unidades del feed simulado es aproximada.** Los arribos se calculan por parada, y en la 65 cada sentido tiene paradas propias, así que el ETA corresponde al sentido elegido.

---

## 7. Verificación

- `npm run build`, `npx tsc --noEmit` y `npx eslint src scripts` sin problemas nuevos (baseline: 0).
- Recorrido manual a 390×844, en las dos rutas:
  1. Abrir `/inicio` → "Línea 65 · Parque Centenario" con 3 arribos, **sin scroll**.
  2. Tocar 194 → cambian el mapa, la card y los arribos (Terminal Once).
  3. "Cambiar dirección" → cambian el subtítulo y el recorrido del mapa, y la parada salta a la más cercana.
  4. Tocar el nombre de la parada → elegir otra → cambian los arribos.
  5. Tocar 151 → aparece el aviso y no se rompe nada.
  6. Tocar el mapa o "Ver mapa" → `/mapas` con la línea filtrada y la burbuja de la parada.
  7. Tocar un viaje reciente → `/viaje?trip=1…`, igual que antes.
  8. Scroll → asistente, accesos y alertas siguen funcionando.
  9. `/inicio/b` → orden de la imagen 2 e Inicio activo en el nav.
