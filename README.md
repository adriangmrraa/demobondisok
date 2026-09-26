# Transportes AMBA • Monitoreo en Vivo (Pre-MVP)

Repositorio oficial del proyecto **pre-mvp-transportes** de **Fusa Labs**.
Aplicación web interactiva y PWA mobile-first para el seguimiento cartográfico y monitoreo en tiempo real de la flota de colectivos del Área Metropolitana de Buenos Aires (AMBA).

---

## 🏗️ Arquitectura y Stack Tecnológico

- **Core Framework**: [Next.js 16 (Turbopack)](https://nextjs.org/) + [React 19](https://react.dev/).
- **Motor Cartográfico**: [MapLibre GL](https://maplibre.org/) renderizado en GPU (WebGL) a 60fps con LOD dinámico (Badge upright $\to$ Cenital rotado $\to$ Isométrico 3D).
- **Estilos & UI**: [Tailwind CSS v4](https://tailwindcss.com/) con tokens semánticos OKLCH y utilidades de Safe Areas móviles (`env(safe-area-inset-*)`).
- **Geometría y Ruteo**: Traza canónica de alta precisión extraída de OSRM (Open Source Routing Machine) proyectada en WGS84 (`EPSG:4326`).
- **Simulación GPS**: Motor de telemetría sintética con dead-reckoning LERP y emisión GTFS-RT a 1 Hz.

---

## 📌 Resumen de Avances Logrados

### 1. Calibración Cartográfica — Fase 1 (Línea Piloto 200 Centro – Sur)
- **Geometría Canónica OSRM**: Incorporación de `src/data/routes.json` con la polilínea continua de **375 vértices** snappeada al eje de las calles porteñas (~0.11 m de precisión WGS84).
- **Paradas Calibradas al Milímetro**: 6 paradas proyectadas directamente sobre la calzada ($0.00\text{ m}$ de offset de la traza) con distancias acumuladas (`alongM`) estrictamente monótonas:
  1. `stop-006`: Plaza de la República (Obelisco) — `[-58.381950, -34.603304]` ($0\text{ m}$)
  2. `stop-002`: Diagonal Norte y Florida — `[-58.379766, -34.604846]` ($745\text{ m}$)
  3. `stop-001`: Av. Corrientes y Suipacha — `[-58.381238, -34.606098]` ($2303\text{ m}$)
  4. `stop-005`: Av. de Mayo y Perú — `[-58.378957, -34.608872]` ($3842\text{ m}$)
  5. `stop-004`: Metrobús 9 de Julio y Belgrano — `[-58.380944, -34.611846]` ($5376\text{ m}$)
  6. `stop-007`: Av. 9 de Julio e Independencia — `[-58.381747, -34.613119]` ($6286\text{ m}$)
- **Fin del Bug de Saltos Diagonales**: Refactorización del cálculo de segmentos en `src/mock/live.ts` (`buildRouteCache` y `positionAtDistance`), eliminando la conexión de cierre artificial por módulo que cruzaba la ciudad.
- **Despacho Equitativo de Flota**: Unidades (`1234`, `0871`, `2045`, `1892`) distribuidas con espaciado de cabecera regular a lo largo del recorrido.

### 2. Sistema Modular Dark / Light Mode
- **`ThemeProvider` React Context (`src/components/theme/ThemeProvider.tsx`)**: Manejo ordenado de estado `'light' | 'dark' | 'system'` con persistencia en `localStorage` (`amba-transportes-theme`).
- **Script Anti-FOUC (`src/app/layout.tsx`)**: Inyección IIFE síncrona en `<head>` y `suppressHydrationWarning` en `<html>` para eliminar parpadeos de carga y advertencias de hidratación.
- **Sincronización WebGL en Caliente (`src/components/map/MapCanvas.tsx`)**: Re-skinning dinámico entre **CARTO Voyager** (claro) y **CARTO Dark Matter** (oscuro) preservando el canvas WebGL sin destrucciones de contexto.
- **Botonera Ergonómica (`ThemeToggle.tsx`)**: Botón flotante accesible con touch target de **44×44px** y transición animada entre `Sun` y `Moon`.

---

## 🎯 Próxima Sesión — Roadmap & Tareas Pendientes

Para la siguiente sesión de trabajo se abordarán las siguientes prioridades funcionales y ergonómicas:

- [ ] **1. Verificación y Renderizado de Íconos de Paradas**:
  - Asegurar que los marcadores de las paradas en el mapa rendericen de forma nítida y legible.
  - Verificar que las etiquetas y modales identifiquen claramente la parada y las líneas que operan en ella.
- [ ] **2. Horarios y Estimaciones de Llegada por Parada**:
  - Integrar el detalle de frecuencias, horarios programados y ETAs en tiempo real en la ficha de cada parada seleccionada.
  - Sincronizar el panel inferior (`BottomSheetPanel`) con los tiempos de arribo calculados según la posición real de las unidades.
- [ ] **3. Rediseño Ergonómico del Selector de Líneas (Mobile Thumb Zone)**:
  - **Simplificación visual**: Reemplazar los chips anchos de texto `"Línea 200"` por badges compactos numéricos (ej: `"200"`).
  - **Orientación vertical lateral**: Transformar el carrusel horizontal superior en un dock/sidebar flotante vertical ubicado a un costado de la pantalla, optimizado para el alcance natural del pulgar en smartphones.

---

## 💻 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (Turbopack)
npm run dev

# Verificación de tipos TypeScript
npx tsc --noEmit
```

---

## 🚀 Convenciones del Repositorio

- **Commits**: Estándar estricto de [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Sin atribución de IA**: Prohibida la inclusión de `Co-Authored-By` u otras marcas en commits.
- **Validación Continua**: Todo cambio debe compilar con 0 errores de TypeScript antes de ser integrado.

---
© 2026 Fusa Labs. Todos los derechos reservados.
