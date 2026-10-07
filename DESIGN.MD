# DESIGN.MD — La Nueva Metropol (AMBA)

> Design system oficial del proyecto. Refleja el estado real del código en `src/`.
> **Reemplaza la versión Mobbin.com que estaba antes (octubre 2026).**

---

## Overview

La Nueva Metropol es una app de transporte de colectivos del AMBA, mobile-first, con mapa en vivo, planificación de viaje y combinaciones con tren/subte. El sistema visual tiene una **regla central**:

- **Chrome de la UI = monocromático** (casi todo blanco, negro, hairlines). El marco de la app es neutro para que la data del transporte (colectivos, líneas, paradas) sea lo que destaque.
- **Datos del transporte = cromáticos**. Los colores de línea, los estados de viaje, las alertas y el logo son la ÚNICA fuente de saturación en la pantalla.

Esa disciplina es la que hace que el "65" rojo, el "194" verde, o el badge "CABECERA" ámbar salten a la vista sin que el chrome compita.

> **Convención de paleta del cliente** (en llamada del 2026-10-07): el número de línea debe ser **gigante y del color de la línea**, no del color de marca. El "ETA" debe ser **la pieza visual más grande del modo viaje**.

---

## Brand

### Identidad oficial (logo Metropol)

Tres colores de marca definidos en `src/components/brand/metropol-logo.tsx:34-38`:

| Token | Hex | Uso |
|---|---|---|
| `METROPOL_COLORS.navy` | `#1D2B4F` | Wordmark del logo en variante `full` |
| `METROPOL_COLORS.red` | `#E30613` | Pétalos rojos de la rosa |
| `METROPOL_COLORS.green` | `#228135` | Hojas verdes de la rosa |

> El logo es un SVG oficial extraído de `metropol.com.ar`. Variantes: `full` (colores) y `mono` (currentColor).
>
> **Token de marca en código:** `tokens.brand.primary = #1D2B4F` (`src/lib/theme.ts:9`) — el mismo navy del wordmark. Es el valor a usar cuando el código necesite "el azul Metropol" (superficies, acentos de marca); `primaryHover = #152248`.

### Tono

- **Profesional pero cercano**. La app es la herramienta del pasajero común, no del operador.
- **Castellano rioplatense** en microcopy (voseo cuando aplica, labels de UI estándar sin voseo para mantener la convención de Google Maps / Moovit).
- **Sin emojis decorativos** salvo el saludo inicial ("Hola 👋" en home).

---

## Tokens del chrome (monocromático)

Definidos en `src/app/globals.css:44-89` (light) y `:91-123` (dark). Mapeados a Tailwind v4 vía `@theme inline` (líneas 6-42) como `--color-*`.

### Light theme (`:root`)

| Token CSS | Hex | Tailwind class | Uso |
|---|---|---|---|
| `--canvas` | `#ffffff` | `bg-canvas`, `text-canvas` | Fondo de página y cards |
| `--canvas-soft` | `#f3f3f3` | `bg-canvas-soft` | Tinta de cards destacadas, nav pill, FAQ |
| `--field` | `#f0f0f0` | `bg-field` | Fill de inputs en estado de reposo |
| `--hairline-soft` | `#f0f0f0` | `border-hairline-soft` | Outline 1px en cards blancas sobre blanco |
| `--hairline` | `#e0e0e0` | `border-hairline` | Border de inputs, separadores |
| `--ink` | `#141414` | `text-ink`, `bg-ink` | Texto crítico, CTAs primary, números de display |
| `--ink-soft` | `#262626` | `text-ink-soft` | Texto secundario elevado |
| `--text-muted` | `#707070` | `text-text-muted` | Texto secundario (sublabels, captions) |
| `--text-faint` | `#adadad` | `text-text-faint` | Texto terciario (placeholders, fine print) |
| `--electric-blue` | `#0066ff` | `text-electric-blue`, `bg-electric-blue` | Acento único: highlights de selección, ring focus |
| `--viajando-green` | `#2f5d4b` | `bg-[var(--viajando-green)]` | Estado "viajando" en rosa FAB |
| `--viajando-yellow` | `#a98b4e` | `bg-[var(--viajando-yellow)]` | Estado "llegando" en rosa FAB |
| `--destructive` | `#dc2626` | `bg-destructive` | Estados destructivos / críticos |

### Dark theme (`.dark`)

Invierte el modelo:

| Token CSS | Hex |
|---|---|
| `--canvas` | `#121212` |
| `--canvas-soft` | `#1a1a1a` |
| `--field` | `#222222` |
| `--hairline-soft` | `#262626` |
| `--hairline` | `#333333` |
| `--ink` | `#f5f5f5` (texto claro sobre fondo oscuro) |
| `--ink-soft` | `#e5e5e5` |
| `--text-muted` | `#a0a0a0` |
| `--text-faint` | `#666666` |
| `--electric-blue` | `#3385ff` (más claro para contraste en dark) |
| `--destructive` | `#ef4444` |

### Reglas de uso del chrome

- **CTAs primary** siempre son `bg-ink` con `text-canvas`. Nunca `bg-electric-blue`.
- **Electric blue** es exclusivo para: ring de focus, highlights de selección activa, badges contextuales. Escasez es la regla: 1 o 2 elementos por pantalla.
- **Sin sombras**. La elevación se construye con `bg-canvas-soft` (tinta 3-4%) y hairlines 1px. Más rápido, más limpio, mejor en OLED.
- **Sin gradientes** en chrome (salvo el logo y animaciones de pulso de arrival spectrum).

---

## Tokens de datos del transporte (cromáticos)

Estos tokens viven en los DATOS, no en CSS. La razón: cada línea de colectivo tiene su color de marca propio, y el color **viaja con la línea** a través de la base (`routes.json`, `metropol.json`).

> **Nota sobre `metropol.json`:** la base scrapeada del sitio **no define colores** (campos: `number`, `name`, `image`, `recorridos[]`, `flota`). Es contenido editorial, no tokens. Los colores por línea viven en `src/data/routes.json`; la única excepción es la Línea 65, cuyos colores oficiales (celeste/rojo) están en `src/lib/theme.ts` (`fleetColors`). Si buscás "color" en `metropol.json`, no va a estar — usar `routes.json` o `linea.color`/`linea.colorHex` en runtime.

### Colores por línea (de `src/data/routes.json`)

| Línea | Ida (hex) | Vuelta (hex) | Notas |
|---|---|---|---|
| 65 | `#0284C7` (azul cielo) | `#EA580C` (naranja) | Línea piloto, color "oficial" según theme.ts es `#0EA5E9`/`#EF4444`. **Inconsistencia a resolver.** |
| 194 | `#06B6D4` (cyan) | `#15803D` (verde oscuro) | Recorridos largos AMBA |
| 60 | `#7C3AED` (violeta) | `#7C3AED` | Duplicado histórico de la 65, mismo color |
| (otras en dataset) | `#10B981`, `#84CC16`, `#3B82F6`, `#14B8A6`, `#6366F1`, `#EF4444`, `#A855F7`, `#9333EA` | variantes claras | Ver `routes.json` línea 566+ |

> **Convención ida/vuelta** (en `src/lib/theme.ts:18-21`):
> - Ida = celeste/cyan (más frío, "vamos")
> - Vuelta = rojo/naranja (más cálido, "volvemos")
>
> Esta convención está aplicada en el código de buses (línea 2119-2121 de `MapCanvas.tsx`) pero NO en las rutas del mapa (línea 1776-1778 de `MapCanvas.tsx`), que usan los colores de `routes.json`. **Esto causa que un mismo colectivo se vea azul/naranja en la ruta y celeste/rojo en el badge del colectivo**. Es un bug visual conocido.

### Estados del servicio (en `src/lib/theme.ts:30-46`)

| Estado | Color | Background (10% opacity) | Uso |
|---|---|---|---|
| `normal` | `#10b981` (verde) | `rgba(16, 185, 129, 0.1)` | Badge "Normal" |
| `demoras` | `#f59e0b` (ámbar) | `rgba(245, 158, 11, 0.1)` | Badge "Demoras" |
| `interrumpido` | `#ef4444` (rojo) | `rgba(239, 68, 68, 0.1)` | Badge "Interrumpido" |

### Ocupación (en `src/lib/theme.ts:49-61`)

| Nivel | Color | Uso |
|---|---|---|
| `baja` | `#10b981` (verde) | "Baja ocupación" |
| `media` | `#f59e0b` (ámbar) | "Media ocupación" |
| `alta` | `#ef4444` (rojo) | "Alta ocupación" |

### Estados de viaje (en `src/components/trip-map-navigation.ts` → `arrivalPhase`)

| Phase | Color | Uso |
|---|---|---|
| `VIAJANDO_GREEN` | `--viajando-green` (`#2f5d4b`) | Rosa FAB + indicador de viaje normal |
| `VIAJANDO_YELLOW` | `--viajando-yellow` (`#a98b4e`) | Rosa FAB + indicador "llegando pronto" |
| `ARRIBANDO` | `red-600` | Rosa FAB + indicador crítico |
| `IDLE` (default) | `bg-canvas` | Rosa FAB en estado de reposo |

---

## Typography

**Familia única:** Inter (vía `next/font/google`, declarada en `src/app/layout.tsx:9-13` con subsets latin y CSS variable `--font-inter`).

```css
font-family: var(--font-inter, Inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### Escala tipográfica (basada en uso real del código)

| Rol | Tamaño aprox. | Peso | Uso en el código |
|---|---|---|---|
| Display XL | `text-6xl` (60px) | `font-black` | Número de línea en hero de `JourneyGuide` |
| Display L | `text-2xl` (24px) | `font-black` | Títulos de pantalla de viaje |
| Heading | `text-xl` (20px) | `font-bold` | Headers de sección (h2), sheet de viaje |
| Body L | `text-lg` (18px) | `font-bold` | Labels de cards destacadas |
| Body | `text-base` (16px) | `font-medium` | Texto estándar |
| Body SM | `text-sm` (14px) | `font-medium` | Sublabels, captions |
| Body XS | `text-xs` (12px) | `font-bold` | Captions, badges |
| Mono | `tabular-nums` | varios | Números que cambian dinámicamente (ETA, minutos) |

### Reglas

- **Letter-spacing 0** (sin tracking adjustments). El grotesque está en su fit natural.
- **Tabular numerals** (`tabular-nums`) en todo número que se actualiza con el tiempo (ETA, minutos, count). Evita que el texto "salte" al cambiar de 1 a 2 dígitos.
- **Line height 1.0-1.4** según jerarquía.
- **Sentence case** en headlines. Sin all-caps, salvo en eyebrows (`tracking-[0.14em] uppercase` en JourneyGuide y ViajePanel para microcopy de etiqueta).

---

## Layout

### Spacing (escala de 4dp, Material)

Definido en `src/app/globals.css:37-41` (radius) y usado vía clases Tailwind arbitrarias:

| Token | Valor | Uso |
|---|---|---|
| `p-1` / `gap-1` | 4dp | Átomos, espacio entre icono y label |
| `p-2` / `gap-2` | 8dp | Padding interno de chips |
| `p-3` / `gap-3` | 12dp | Padding de cards chicas |
| `p-4` / `gap-4` | 16dp | Padding estándar de cards, gap entre botones |
| `p-5` / `gap-5` | 20dp | Padding de cards grandes, header de pantalla |
| `p-6` / `gap-6` | 24dp | Padding de sheets |
| `m-12` | 48dp | Safe area de FABs |

### Border radius

| Token | Valor | Tailwind | Uso |
|---|---|---|---|
| `radius-sm` | 16px | `rounded-2xl` (16-20px) | Inputs, cards chicas |
| `radius-md` | 24px | `rounded-3xl` (24px) | Cards estándar, sheets |
| `radius-lg` | 24px | `rounded-3xl` | Idem (alias) |
| `radius-xl` | 32px | `rounded-[28px]` (28px) | Bottom nav pill |
| `radius-full` | 9999px | `rounded-full` | Botones pill, badges, dots |

Definidos en `src/app/globals.css:37-41`. **El nav pill del bottom usa 28px** (`src/components/ui/bottom-nav.tsx:103` con `rounded-[28px]`), no 32 ni 24.

### Safe areas

Variables CSS para safe areas nativas (notch, home bar) en `src/app/globals.css:46-49`:

```css
--sat: env(safe-area-inset-top, 0px);
--sab: env(safe-area-inset-bottom, 0px);
--sal: env(safe-area-inset-left, 0px);
--sar: env(safe-area-inset-right, 0px);
```

Aplicadas en componentes clave:

- `BottomNav`: `pb-[max(env(safe-area-inset-bottom),12px)]`
- `MapCanvas`: `top-[calc(max(14px,env(safe-area-inset-top))+...)]` (en LineSelectorBar)
- `HomePage`: `pb-[104px]` (reserva para el bottom nav)
- `mapas/page.tsx`: `pt-[calc(20px+env(safe-area-inset-top))]`

### Touch targets

- **Mínimo 44×44dp** (Apple HIG) — cumplido en `ThemeToggle` y la mayoría de botones.
- **Mínimo 48dp** recomendado (Material) — en CTAs primarios y bottom nav.
- **Spacing 8dp mínimo** entre targets adyacentes.

### Shadows

- **No usar `shadow-sm`/`shadow-md` en chrome.** La elevación se construye con tints.
- **Excepción única:** sheets modales con `shadow-[0_16px_45px_-4px_rgba(0,0,0,0.22)]` (ver `ViajePanel.tsx:98,150,166`). En dark mode es más opaco: `shadow-[0_20px_50px_-4px_rgba(0,0,0,0.7)]`.

---

## Iconography

**Librería:** `lucide-react` (consistente, open source, 1.5px stroke).

```ts
import { Map, MapPin, Navigation, Route, Search, Bus, Home } from 'lucide-react';
```

### Tamaños

| Tamaño | Uso |
|---|---|
| `size-3.5` (14px) | Inline en body |
| `size-4` (16px) | Default en CTAs, inputs |
| `size-5` (20px) | Headers de sección, BottomNav items |
| `size-7` (28px) | Hero, Brand mark |
| `size-12` (48px) | Loading states |

### Reglas

- **Nunca íconos decorativos** — cada ícono tiene función.
- **CTAs con ícono + texto** — nunca ícono solo (calles, prisa, sol).
- **Color:** heredan del texto (`text-ink`, `text-text-muted`, `text-electric-blue`). Excepción: íconos dentro de badges de línea usan `text-white` (sobre el color de la línea).

---

## Component catalog (alto nivel)

Componentes que YA EXISTEN en el repo. El dev nuevo debe familiarizarse con estos antes de crear nuevos.

### Brand
- `MetropolLogo` (`src/components/brand/metropol-logo.tsx`) — logo SVG oficial, variantes `full` y `mono`.
- `MetropolRose` (mismo archivo) — solo la rosa, sin wordmark. Usada en el FAB del bottom nav.

### UI primitives (`src/components/ui/`)
- `LineBadge` (`line-badge.tsx`) — chip de línea con color de marca. Variantes `sm` (24px) y `md` (32px). Usado en `HomePage` y en el badge de vehículo seleccionado.
- `Badge` (`badge.tsx`) — badge genérico shadcn-style.
- `Button` (`button.tsx`) — botón base.
- `Card` (`card.tsx`) — card base shadcn-style.
- `Dialog` (`dialog.tsx`) — diálogo modal.
- `Input` (`input.tsx`) — input de formulario.
- `BottomNav` (`bottom-nav.tsx`) — **navegación principal** (ver sección dedicada).

### Shell (`src/components/ui-shell/`)
- `BottomSheetPanel` — sheet inferior con drag para colapsar/expandir.
- `FloatingSearch` — barra de búsqueda flotante.
- `InlineBusIndicator` — indicador inline de colectivo (badge inline).
- `LineSelectorBar` — **rail vertical de líneas y ramales** (sidebar a la izquierda del mapa, optimizado para thumb zone).
- `LiveTransportBubble` — bubble animada de colectivo en vivo.
- `StopDetailCard` / `StopDetailDialog` — detalle de parada.

### Home (`src/components/home/`)
- `ClassicTripActions` — **las 4 acciones de home** (Buscar línea / Paradas cerca / ¿A dónde vas? / Explorar mapa) en grid 2x2.
- `AssistantBar` — barra principal con "¿A dónde vas?".
- `AssistantAnswerSheet` — sheet con respuesta del asistente.
- `AssistantWizard` — wizard de 3 pasos (consentimiento → parada → destino).
- `LineLookupSheet` — sheet de lookup de línea específica.
- `LocationConsentModal` — modal de consentimiento de GPS.
- `PlaceSelector` — selector de lugar (origen/destino).

### Viaje (`src/components/viaje/`)
- `JourneyGuide` — **hero con ETA gigante + paso a paso** (`text-6xl` para número de línea, fondo `bg-ink` invertido).
- `JourneyOptionList` — lista de opciones de viaje.
- `JourneyTimeline` — timeline de pasos (walk/transfer/ride con íconos).
- `ViajeHeader` — header flotante del modo viaje.
- `ViajePanel` — **panel inferior con tabs Opciones/Pasos** (`src/components/viaje/ViajePanel.tsx:468`). El lugar donde se concentran la mayoría de las decisiones de UX del modo viaje.
- `ArrivalStatusCard` — card de status de arrival.

### Map (`src/components/map/`)
- `DynamicMap` — wrapper con timeout de 12s, marca mapa como `unavailable` si no carga.
- `MapCanvas` — **el mapa principal** (2700+ líneas, la pieza más grande del repo).

### Theme (`src/components/theme/`)
- `ThemeProvider` — Context con `light | dark | system`, persistencia en localStorage.
- `ThemeToggle` — botón flotante de tema.

---

## Bottom nav y la rosa FAB

El bottom nav (`src/components/ui/bottom-nav.tsx`) es **la pieza de navegación más distintiva**. Tiene 3 items: **Líneas (izq) · Rosa FAB (centro, elevada) · Inicio (der)**.

### Estructura visual

```
┌────────────────────────────────────────────┐
│  [🚌 Líneas]      🌹      [🏠 Inicio]      │  ← 64dp, rounded-[28px], border-hairline
└────────────────────────────────────────────┘
                  ↑
                  └─ FAB elevada -top-3.5, w-[56px] h-[56px], rounded-full
```

### Semántica de la rosa (3 comportamientos)

| Acción | Resultado | Line |
|---|---|---|
| **Un toque** (sin viaje activo) | Navega a `/mapas` | `bottom-nav.tsx:71-74` |
| **Un toque** (con viaje activo en `/mapas`) | Toggle de la vista del viaje (mantiene estado) | `bottom-nav.tsx:72-74` |
| **Doble tap** (en 320ms) | Abre el **Modo Viaje** (idempotente, query `?trip=1`) | `bottom-nav.tsx:64-93` |

### Estados de color de la rosa

| Estado | Background | Ring | Cuándo |
|---|---|---|---|
| IDLE (default) | `bg-canvas` (light) / `bg-[#1D2B4F]` (dark) | `ring-white` 4px | Sin viaje activo |
| `VIAJANDO_GREEN` | `bg-[var(--viajando-green)]` | `ring-[var(--viajando-green)]` 5px | Viaje en curso normal |
| `VIAJANDO_YELLOW` | `bg-[var(--viajando-yellow)]` | `ring-[var(--viajando-yellow)]` 5px | Llegando pronto |
| `ARRIBANDO` | `bg-red-600` | `ring-red-600` 5px | Crítico, por llegar |

---

## Modo Viaje (Sistema)

El modo viaje es el flujo crítico del producto. Está compuesto por:

### Vista de mapa con viaje activo (`/mapas?trip=...`)

- Header flotante (`ViajeHeader`) con origen/destino, swap, clear.
- Botón de colectivo seleccionado pill (mostrando línea, ramal, coche, próxima parada con ETA).
- Mapa con `tripSegments` y `tripRouteShade` superpuestos al recorrido base.
- Camera mode `follow-trip` o `follow-vehicle` (configurable).

### Vista de guía de viaje (`/viaje`)

Página dedicada, no-modal. Layout:

1. Header con origen → destino.
2. Si hay opción seleccionada: `JourneyGuide` (hero + paso a paso).
3. Si no hay opción seleccionada: `JourneyOptionList` (resumen de todas las opciones).

### Sheet inferior (`ViajePanel`)

Solo se monta cuando hay un viaje activo en `/mapas`. Tiene:

- Drag handle (grip 36×4dp).
- Header pinned con duración total + alternativas + tabs.
- Tabs **Opciones** / **Pasos**:
  - **Opciones**: cards con duración + línea(s) + transbordos + walk distance.
  - **Pasos**: timeline con íconos walk/transfer/ride.
- Botón de cerrar.

### Tipos de paso (`step.type` en `src/types/trip-planner.ts`)

| Tipo | Ícono | Color | Significado |
|---|---|---|---|
| `walk` | `Footprints` (lucide) | default | Caminar |
| `transfer` | `Layers` (lucide) | amber-700/400 | Transbordo entre líneas |
| `ride` | `Bus` (lucide) | color de la línea | Viaje en colectivo |

---

## Sistema de mapa (`MapCanvas`)

`src/components/map/MapCanvas.tsx` es la pieza más grande del proyecto (~2700 líneas). La documentación completa de su arquitectura está en los comentarios JSDoc del archivo (líneas 1-19).

### Stack

- **MapLibre GL JS v6** (WebGL, 60fps).
- **CARTO Voyager / Dark Matter** como basemap (gratis, sin API key).
- **Worker de MapLibre** servido desde `/maplibre/` (script `scripts/copy-maplibre-worker.mjs` que copia el worker en `predev` y `prebuild`).
- **Símbolos SVG rasterizados** vía `addImage` para buses, paradas, POIs. Ver `src/lib/map/vehicle-sprites.ts` (216 líneas de SVG).

### Representaciones de colectivo según zoom

| Zoom | Representación | Spec |
|---|---|---|
| z < 13.5 | Badge upright con número + heading | `buses-badge` + `buses-heading` |
| 13.4–15.6 | Colectivo cenital rotado por heading | `buses` (top-down) |
| z ≥ 14.4 | Colectivo isométrico 3/4 (Tipo D) | `buses-iso` con billboard relativo a cámara |

Crossfade por zoom (interpolate top-level, sin writes por frame).

### Capas de POIs y mobiliario urbano

`snapshots` de OSM (semáforos, PARE, cruces, iglesias, supermercados, estaciones) servidos desde `/data/pois.json`. Ícono discreto: circulito blanco con borde navy. Ver `src/lib/map/urban-features.ts`.

### Capas de viaje activo

- `trip-active-segments` — casing + línea para los segmentos del viaje (walk dashed, ride sólido).
- `trip-route-shade` — sombreado del recorrido cortado en una parada de referencia.
- `trip-used-stops` — paradas del viaje con roles (board verde, transfer ámbar, alight rojo).

### Pulso de ruta (spec #861)

Período **1800ms module-level** (origen en `performance.now()`). Dos halos contrafase (`route-halo-a` y `route-halo-b`) con `line-blur` para el efecto de "respiración". Solo anima `line-opacity` y `line-blur` (uniforms GPU baratos).

### ✅ Pitfall resuelto: iOS Safari mapa en blanco (PBI-014)

**Causa:** `transform: translateZ(0)` en un ancestro del `<canvas>` WebGL creaba un bug de compositing en WebKit que dejaba el canvas en negro (afectaba iPhone/iPad; Blink lo toleraba, por eso era iOS-only).

**Fix aplicado:** se quitó el `translateZ(0)` del header flotante de `src/app/mapas/page.tsx` (commit `c0871ea`). Verificado en WebKit real (Playwright, iPhone 11, contra producción) el 2026-10-07: tiles, zoom y trip mode OK. Detalle en `docs/INCIDENTE-MAPA-iOS-SAFARI.md`.

**Regla de oro (vigente):** **NUNCA** promover a capa compuesta un ancestro del contenedor de MapCanvas — ni `translateZ(0)`, ni `will-change: transform`, ni `translate3d`. Ver el comentario en `MapCanvas.tsx:2696-2706` que documenta este patrón.

---

## Alertas

`src/lib/data-service.ts` define el tipo `Alert` con tipos: `delay`, `suspension`, `route_change`. Mapeo a labels (en `src/app/inicio/page.tsx:56-60`):

| Tipo | Label | Color |
|---|---|---|
| `delay` | RETRASO | `#d97706` (ámbar) |
| `suspension` | CORTE | `#d97706` |
| `route_change` | DESVÍO | `#d97706` |

Las alertas se muestran en el home con badge titilando (`animate-pulse` Tailwind) en cada viaje del historial de paradas. Ver `inicio/page.tsx:508-512`.

---

## Motion

### Principios

- **Movimiento al servicio de la comprensión.** Nunca decoración.
- **Duración máxima 300ms** para transiciones de UI. Más largo se percibe como lentitud.
- **Curvas:** `ease-out` para entradas, `ease-in` para salidas.

### Animaciones predefinidas (en `globals.css`)

| Animación | Spec | Uso |
|---|---|---|
| `bus-pulse` (línea 149-159) | 2s infinite, `cubic-bezier(0.4, 0, 0.6, 1)` | Pulse de colectivo en vivo (radar) |
| `arrival-blink` (línea 169-178) | 1.2s ease-in-out infinite | Blink de arrival (alerta de viaje por llegar) |
| `transfer-pop` (línea 180-190) | 0.6s ease-out | Pop de transbordo |
| `transfer-rise` (línea 203-215) | 1.1s ease-out forwards | Orb que sube al transferir |
| `ride-pulse` (línea 217-224) | 1.2s ease-in-out infinite | Pulse de ride |
| `rutaba-live-pulse` (línea 247+) | período del pulse vivo | Sincronizado mapa + timeline |
| `energy-aura-rise`, `energy-ribbon-rise`, etc. (línea 460+) | 1.2-1.3s | Arrival energy spectrum (decoración visual) |

### Framer Motion

Se usa `motion/react` (`useReducedMotion`, `motion.div`, `AnimatePresence`). Accesibilidad: el `useReducedMotion` se respeta en el pulse de ruta y en la animación del planner pulse.

### No animar

- Números que cambian de valor (el cambio es claro, la animación distrae).
- Carga inicial (usar skeleton, no spinner — pero hoy hay un spinner `Loader2` en `DynamicMap`).
- Cambios de tema (transición de color 200ms en `body`, `globals.css:93`).

---

## Accessibility

### Contraste

- Texto crítico sobre `bg-canvas` (blanco) usa `text-ink` (#141414) → contraste **17.4:1** (AAA).
- Texto secundario `text-text-muted` (#707070) sobre blanco → contraste **4.7:1** (AA).
- Texto terciario `text-text-faint` (#adadad) sobre blanco → contraste **2.8:1** (NO apto para texto crítico, solo decorative).
- En dark mode, los contrastes se mantienen porque los hex se invierten preservando la relación.

### Color no es el único canal

- Estado de viaje: combina color (verde/amarillo/rojo) + ring (5px) + ícono.
- Badges de línea: combinan color + número + (opcional) texto.
- Ocupación: combina color + texto ("Baja / Media / Alta").

### Touch targets

- `min-h-[44px]` o `min-w-[44px]` en todos los botones touch.
- 8dp de spacing entre targets adyacentes.

### Sensores y permisos

- GPS: `LocationConsentModal` antes de activar (no se activa sin consentimiento explícito).
- Ambient light: NO soportado (PBI-012 post-MVP).

### Screen readers

- `aria-label` en todos los botones de ícono (bottom nav, line selector, theme toggle).
- `aria-live="polite"` en cambios de ETA y arrival card.
- `aria-current="page"` en ítems activos del bottom nav.
- `aria-pressed` en el toggle de líneas.

### Reduced motion

`useReducedMotion` se respeta en:
- Pulse de ruta en mapa (línea 450 de `MapCanvas.tsx`).
- Planner pulse (líneas 1120-1128).

---

## Performance

### Build

- **Next.js 16** con Turbopack. Importante: `AGENTS.md` del proyecto avisa "This is NOT the Next.js you know" — leer `node_modules/next/dist/docs/` antes de tocar código de Next.
- **`predev` y `prebuild`** ejecutan `scripts/copy-maplibre-worker.mjs` que copia el worker de MapLibre a `public/maplibre/`.

### MapLibre

- Vector tiles CARTO (132KB por tile z13 BA), cacheables.
- Símbolos SVG pre-rasterizados en `addImage` (carga única, no se repinta cada frame).
- Render 60fps con interpolación LERP en cliente sobre feed a 1Hz.
- Worker de MapLibre para off-main-thread tile parsing.

### Imágenes y assets

- Logos y assets de líneas en `/public/images/metropol/lineas/`.
- POIs OSM en `/public/data/pois.json` (snapshot).
- Bundle de icons via `lucide-react` (tree-shakeable).

### Fuentes

- `next/font/google` para Inter (subset latin, display: swap).
- `display: swap` evita FOUT pero acepta FOUT menor a cambio de mejor LCP.

---

## Do's and Don'ts

### Do

- **Usar `text-ink` para texto crítico, `text-text-muted` para secundario, `text-text-faint` para terciario.** Jerarquía visual clara.
- **Usar `bg-ink` para CTAs primary.** El azul eléctrico es solo highlight, nunca CTA.
- **Usar tokens semánticos** (`bg-canvas`, `border-hairline`, `text-ink`) en vez de hexes hardcoded. El dark mode se rompe si usás hex.
- **Respetar safe areas** con `env(safe-area-inset-*)` en cualquier elemento anclado a un borde de pantalla.
- **Usar `tabular-nums`** en números dinámicos (ETA, minutos).
- **Touch targets >= 44dp.** Tappable con prisa, dedos mojados, sol de frente.
- **Dark mode:** verificar TODO cambio en dark también. El `ThemeProvider` + script anti-FOUC ya está implementado.
- **Testear con `useReducedMotion` activo.** El pulse de ruta y el planner pulse lo respetan.

### Don't

- **No usar hex hardcoded** en componentes. Pedir al cliente del color (`linea.color`, `linea.colorHex`).
- **No usar `transform: translateZ(0)` o `will-change: transform` en ancestros del `<canvas>` de MapCanvas.** Rompe WebKit (ver sección "Pitfall conocido").
- **No usar `shadow-sm` o `shadow-md` en chrome.** Solo tints (`bg-canvas-soft`) y hairlines. Excepción: sheets modales con shadow específica.
- **No usar `bg-electric-blue` para CTAs.** Solo highlights de selección.
- **No agregar colores de marca adicionales.** El sistema es monocromático + cromático-de-datos. Cualquier color nuevo en chrome rompe la disciplina.
- **No usar `backdrop-blur` en header sobre el mapa.** El filtro re-composita cada frame y titilea (ver `mapas/page.tsx:1160-1162`).
- **No truncar nombres de paradas con `text-ellipsis`.** Hacer wrap a 2 líneas o usar chip expandible.
- **No mostrar el número de coche al pasajero** (PBI-006, feedback del cliente). El interno es solo del operador.
- **No usar `text-text-faint` para texto accionable.** Es solo decorativo.

---

## Migration notes (lo que cambió desde el Mobbin DESIGN.MD)

| Antes (Mobbin) | Ahora (Metropol real) | Razón |
|---|---|---|
| Sistema estrictamente monocromático | Chrome monocromático + datos cromáticos | Los colores de línea son la identidad visual del producto |
| Un solo accent azul (#0066ff) para commercial signals | `electric-blue` para highlights de selección + múltiples colores de estado (verde/ámbar/rojo) | El producto tiene 3 estados críticos (normal/demoras/interrumpido) |
| Sin sombras nunca | Sin sombras en chrome + sombras solo en sheets modales | Las sheets necesitan profundidad sobre el mapa |
| `text-electric-blue` para CTAs | `bg-ink` para CTAs, `text-electric-blue` solo para highlights | Contraste y jerarquía más fuerte |
| Saans 652/456/300 como pesos custom | Inter (un solo peso variable, weights 400-800) | Inter está disponible vía next/font, más estándar |
| `{rounded.full}` (9999px) para TODO | Mix: pills para CTAs y badges, 16-24px para cards, 28px para nav | El nav pill grande es distintivo de la app |

---

## Verificación de coherencia

Para auditar que el código cumple este DESIGN.MD:

1. **Tokens correctos:** `grep -r "#[0-9a-fA-F]\{6\}" src/components src/app` y verificar que los hexes hardcoded sean solo de colores de línea (datos) o de iconos SVG.
2. **CTAs primary:** `grep -r "bg-electric-blue.*text" src/components` no debería tener resultados para CTAs.
3. **Safe areas:** buscar en componentes anclados a bordes (top, bottom) que usen `env(safe-area-inset-*)`.
4. **Touch targets:** `grep -r "min-h-\[\?\([4-9]\|1[0-2]\)" src/components` debería mostrar >= 44dp en CTAs.
5. **Sin translateZ(0) en ancestros de mapa:** `grep -r "translateZ" src/app src/components` no debería tener resultados en el árbol de `/mapas`.
6. **LineBadge usage:** todos los lugares donde se muestra un número de línea deberían usar `LineBadge` con `color={linea.color}` y `shortName={linea.shortName}`.

---

## Referencias

- `src/app/globals.css` — design tokens base (CSS variables + Tailwind v4 mapping)
- `src/lib/theme.ts` — theme tokens oficiales (brand, fleet, status, occupancy)
- `src/components/brand/metropol-logo.tsx` — logo y rosa SVG
- `src/components/ui/line-badge.tsx` — badge de línea
- `src/components/ui/bottom-nav.tsx` — bottom nav con rosa FAB
- `src/components/viaje/JourneyGuide.tsx` — hero con ETA gigante
- `src/components/viaje/ViajePanel.tsx` — sheet inferior de viaje
- `src/components/home/ClassicTripActions.tsx` — 4 acciones de home
- `src/components/map/MapCanvas.tsx` — mapa (2700+ líneas)
- `src/components/map/DynamicMap.tsx` — wrapper con timeout
- `src/data/metropol.json` — datos scrapeados del sitio de Metropol
- `src/data/routes.json` — geometría OSRM y colores por línea
- `docs/DIAGNOSTICO-IPHONE-SAFARI.md` — bug del mapa en iOS + fix propuesta
- `docs/INCIDENTE-MAPA-iOS-SAFARI.md` — documento original del incidente
- `docs/BRECHAS-vs-REPO.md` — análisis de brechas plan vs código real
- `docs/backlog.json` — backlog Scrum (32 PBIs, fuente de verdad del proyecto)
- `docs/BRAINSTORMING.md` — exploración de ideas
- `docs/COMPARATIVA.md` — comparativa cliente vs Replit
- `docs/DESIGN.md` — brief de diseño original (versión 1, abstracta)

---

**Última actualización:** 2026-10-07
**Mantenedor:** equipo Fusa Labs / pre-mvp-transportes
**Próxima revisión:** al agregar componentes o tokens nuevos (PBI-014 ya cerrado)
