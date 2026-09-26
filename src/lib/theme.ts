/**
 * Design Tokens y configuración temática oficial para la maqueta de transportes AMBA
 * Sigue las especificaciones de docs/RECORRIDOS-LINEAS.md y docs/skill-maqueta-oficial.txt
 */

export const tokens = {
  // Paleta corporativa Metropol / AMBA
  brand: {
    primary: "#1D2B4F",
    primaryHover: "#152248",
    surface: "#ffffff",
    surfaceDark: "#18181b",
    border: "#e2e8f0",
    borderDark: "#27272a",
  },

  // Colores oficiales Línea 65 (Celeste Ida / Rojo Vuelta)
  fleetColors: [
    "#0EA5E9", // Ida Línea 65 (Celeste)
    "#EF4444", // Vuelta Línea 65 (Rojo)
  ] as const,

  // Contraste de texto sobre color de línea
  lineOnColor: {
    "#0EA5E9": "#FFFFFF",
    "#EF4444": "#FFFFFF",
  } as const,

  // Estados del servicio
  status: {
    normal: {
      label: "Normal",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
    },
    demoras: {
      label: "Demoras",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
    },
    interrumpido: {
      label: "Interrumpido",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
    },
  },

  // Ocupación de coches
  occupancy: {
    baja: {
      label: "Baja",
      color: "#10b981",
    },
    media: {
      label: "Media",
      color: "#f59e0b",
    },
    alta: {
      label: "Alta",
      color: "#ef4444",
    },
  },

  // Viewport y layout móvil
  layout: {
    headerZIndex: 30,
    bottomSheetZIndex: 40,
    mapControlsZIndex: 20,
    collapsedSheetHeight: 290,
    expandedSheetMaxHeight: "75vh",
  },
} as const;
