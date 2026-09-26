/**
 * geocoder — búsqueda LOCAL de calles, landmarks y lugares para /mapas.
 *
 * Las llamadas runtime a OSM/Nominatim están prohibidas por el plan;
 * el índice vive en el bundle (adapter: cambiar la fuente no toca la UI).
 * Módulo PURO: sin fetch, sin DOM.
 */

import type { LocationPoint } from "@/types/trip-planner";

export type GeoKind = "landmark" | "calle" | "poi" | "parada" | "direccion";

export interface GeoResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: GeoKind;
  /** Extensión aproximada de la vía / entorno del landmark para fitBounds. */
  bounds?: [[number, number], [number, number]];
  stopId?: string;
  aliases?: string[];
}

/** Minúsculas sin acentos: "Constitución" → "constitucion". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function boundsAround(lat: number, lng: number, padDeg = 0.004): [[number, number], [number, number]] {
  return [
    [lng - padDeg, lat - padDeg],
    [lng + padDeg, lat + padDeg],
  ];
}

/**
 * Índice curado de landmarks emblemáticos del AMBA.
 * Coordenadas aproximadas de referencia (demo, no dataset OSM).
 */
export const LANDMARK_INDEX: GeoResult[] = [
  {
    id: "geo-obelisco",
    name: "Obelisco",
    address: "Plaza de la República, Av. 9 de Julio y Av. Corrientes",
    lat: -34.6054,
    lng: -58.3816,
    kind: "landmark",
    aliases: ["obelisco", "plaza de la republica", "monumento obelisco"],
    bounds: boundsAround(-34.6054, -58.3816, 0.0035),
  },
  {
    id: "geo-casa-rosada",
    name: "Casa Rosada",
    address: "Plaza de Mayo, Balcarce 50",
    lat: -34.6132,
    lng: -58.3758,
    kind: "landmark",
    aliases: ["casa rosada", "plaza de mayo"],
    bounds: boundsAround(-34.6132, -58.3758, 0.003),
  },
  {
    id: "geo-teatro-colon",
    name: "Teatro Colón",
    address: "Cerrito 628, San Nicolás",
    lat: -34.6047,
    lng: -58.3825,
    kind: "landmark",
    aliases: ["teatro colon"],
  },
  {
    id: "geo-puerto-madero",
    name: "Puerto Madero",
    address: "Barrio Puerto Madero",
    lat: -34.6145,
    lng: -58.365,
    kind: "landmark",
    aliases: ["puerto madero", "madero"],
    bounds: [
      [-58.375, -34.622],
      [-58.355, -34.607],
    ],
  },
  {
    id: "geo-terminal-retiro",
    name: "Terminal de Retiro",
    address: "Av. Ramos Mejía 1300, Retiro",
    lat: -34.5906,
    lng: -58.3747,
    kind: "landmark",
    aliases: ["retiro", "terminal retiro"],
  },
  {
    id: "geo-plaza-italia",
    name: "Plaza Italia",
    address: "Av. Santa Fe y Av. Figueroa Alcorta, Palermo",
    lat: -34.5809,
    lng: -58.4205,
    kind: "landmark",
    aliases: ["plaza italia", "la rural", "palermo"],
  },
  {
    id: "geo-plaza-san-martin",
    name: "Plaza San Martín",
    address: "San Martín y Florida, Retiro",
    lat: -34.5918,
    lng: -58.374,
    kind: "landmark",
    aliases: ["plaza san martin", "san martin"],
  },
  {
    id: "geo-abasto",
    name: "Abasto / Once",
    address: "Av. Corrientes y Av. Pueyrredón, Balvanera",
    lat: -34.6047,
    lng: -58.4103,
    kind: "landmark",
    aliases: ["abasto", "once"],
  },
  {
    id: "geo-congreso",
    name: "Congreso",
    address: "Plaza del Congreso, Av. Rivadavia",
    lat: -34.6084,
    lng: -58.3735,
    kind: "landmark",
    aliases: ["congreso", "plaza del congreso", "camara de diputados"],
  },
  {
    id: "geo-nunez",
    name: "Núñez",
    address: "Barrio Núñez, Buenos Aires",
    lat: -34.5463,
    lng: -58.4643,
    kind: "landmark",
    aliases: ["nunez", "nuñez"],
  },
  {
    id: "geo-palermo-soho",
    name: "Palermo Soho",
    address: "Costa Rica y Honduras, Palermo",
    lat: -34.588,
    lng: -58.4275,
    kind: "landmark",
    aliases: ["palermo soho", "soho"],
  },
  {
    id: "geo-barracas",
    name: "Barracas",
    address: "Barrio Barracas, Buenos Aires",
    lat: -34.633,
    lng: -58.377,
    kind: "landmark",
    aliases: ["barracas"],
  },
  {
    id: "geo-villa-crespo",
    name: "Villa Crespo",
    address: "Barrio Villa Crespo, Buenos Aires",
    lat: -34.597,
    lng: -58.4405,
    kind: "landmark",
    aliases: ["villa crespo"],
  },
  {
    id: "geo-luna-park",
    name: "Luna Park",
    address: "Av. Corrientes y Bme. Mitre, San Nicolás",
    lat: -34.6016,
    lng: -58.3765,
    kind: "landmark",
    aliases: ["luna park", "estadio luna park"],
  },
  {
    id: "geo-plaza-ejercito",
    name: "Plaza del Ejército / Libertador",
    address: "Av. del Libertador y Dr. Ramos Mejía",
    lat: -34.5878,
    lng: -58.3765,
    kind: "landmark",
    aliases: ["plaza del ejercito", "libertador"],
  },
];

/**
 * Índice curado de avenidas y calles principales del AMBA.
 * `bounds` aproxima el corredor visible de la vía para encuadrarla en el mapa.
 */
export const STREET_INDEX: GeoResult[] = [
  {
    id: "street-cabildo",
    name: "Av. Cabildo",
    address: "Avenida Cabildo, Belgrano — Núñez",
    lat: -34.558,
    lng: -58.4565,
    kind: "calle",
    aliases: ["cabildo", "avenida cabildo", "av cabildo"],
    bounds: [
      [-58.47, -34.575],
      [-58.448, -34.535],
    ],
  },
  {
    id: "street-corrientes",
    name: "Av. Corrientes",
    address: "Avenida Corrientes, Congreso — Palermo",
    lat: -34.6042,
    lng: -58.41,
    kind: "calle",
    aliases: ["corrientes", "avenida corrientes", "av corrientes"],
    bounds: [
      [-58.47, -34.607],
      [-58.36, -34.601],
    ],
  },
  {
    id: "street-rivadavia",
    name: "Av. Rivadavia",
    address: "Avenida Rivadavia, Congreso — Caballito",
    lat: -34.6095,
    lng: -58.42,
    kind: "calle",
    aliases: ["rivadavia", "avenida rivadavia", "av rivadavia"],
    bounds: [
      [-58.51, -34.612],
      [-58.37, -34.606],
    ],
  },
  {
    id: "street-9-julio",
    name: "Av. 9 de Julio",
    address: "Avenida 9 de Julio, Retiro — Constitución",
    lat: -34.605,
    lng: -58.3815,
    kind: "calle",
    aliases: ["9 de julio", "nueve de julio", "avenida 9 de julio", "diagonal norte"],
    bounds: [
      [-58.384, -34.64],
      [-58.379, -34.585],
    ],
  },
  {
    id: "street-santa-fe",
    name: "Av. Santa Fe",
    address: "Avenida Santa Fe, Retiro — Palermo",
    lat: -34.59,
    lng: -58.415,
    kind: "calle",
    aliases: ["santa fe", "avenida santa fe", "av santa fe"],
    bounds: [
      [-58.44, -34.588],
      [-58.375, -34.575],
    ],
  },
  {
    id: "street-cordoba",
    name: "Av. Córdoba",
    address: "Avenida Córdoba, Retiro — Palermo",
    lat: -34.5975,
    lng: -58.41,
    kind: "calle",
    aliases: ["cordoba", "avenida cordoba", "av cordoba"],
    bounds: [
      [-58.44, -34.599],
      [-58.375, -34.594],
    ],
  },
  {
    id: "street-de-mayo",
    name: "Av. de Mayo",
    address: "Avenida de Mayo, Congreso — Plaza de Mayo",
    lat: -34.6095,
    lng: -58.382,
    kind: "calle",
    aliases: ["de mayo", "avenida de mayo", "av de mayo"],
    bounds: [
      [-58.39, -34.611],
      [-58.373, -34.607],
    ],
  },
  {
    id: "street-libertador",
    name: "Av. del Libertador",
    address: "Avenida del Libertador, Retiro — Olivos",
    lat: -34.578,
    lng: -58.4,
    kind: "calle",
    aliases: ["libertador", "avenida del libertador", "av libertador"],
    bounds: [
      [-58.44, -34.575],
      [-58.37, -34.59],
    ],
  },
  {
    id: "street-general-paz",
    name: "Av. General Paz",
    address: "Avenida General Paz, límite CABA",
    lat: -34.555,
    lng: -58.46,
    kind: "calle",
    aliases: ["general paz", "avenida general paz", "av general paz"],
    bounds: [
      [-58.53, -34.57],
      [-58.44, -34.53],
    ],
  },
  {
    id: "street-juan-b-justo",
    name: "Av. Juan B. Justo",
    address: "Avenida Juan B. Justo, Palermo — Devoto",
    lat: -34.5905,
    lng: -58.44,
    kind: "calle",
    aliases: ["juan b justo", "juan bautista justo", "avenida juan b justo"],
    bounds: [
      [-58.47, -34.592],
      [-58.41, -34.588],
    ],
  },
  {
    id: "street-diaz-velez",
    name: "Av. Díaz Vélez",
    address: "Avenida Díaz Vélez, Caballito",
    lat: -34.6042,
    lng: -58.44,
    kind: "calle",
    aliases: ["diaz velez", "avenida diaz velez", "av diaz velez"],
    bounds: [
      [-58.46, -34.605],
      [-58.42, -34.603],
    ],
  },
  {
    id: "street-brasil",
    name: "Av. Brasil",
    address: "Avenida Brasil, Constitución — Barracas",
    lat: -34.626,
    lng: -58.39,
    kind: "calle",
    aliases: ["brasil", "avenida brasil", "av brasil"],
    bounds: [
      [-58.41, -34.627],
      [-58.37, -34.624],
    ],
  },
  {
    id: "street-caseros",
    name: "Av. Caseros",
    address: "Avenida Caseros, Constitución — Parque Patricios",
    lat: -34.6275,
    lng: -58.395,
    kind: "calle",
    aliases: ["caseros", "avenida caseros", "av caseros"],
    bounds: [
      [-58.41, -34.628],
      [-58.37, -34.626],
    ],
  },
  {
    id: "street-belgrano",
    name: "Av. Belgrano",
    address: "Avenida Belgrano, Balvanera — Barracas",
    lat: -34.617,
    lng: -58.4,
    kind: "calle",
    aliases: ["belgrano", "avenida belgrano", "av belgrano"],
    bounds: [
      [-58.42, -34.618],
      [-58.38, -34.615],
    ],
  },
  {
    id: "street-pueyrredon",
    name: "Av. Pueyrredón",
    address: "Avenida Pueyrredón, Recoleta — Once",
    lat: -34.601,
    lng: -58.407,
    kind: "calle",
    aliases: ["pueyrredon", "avenida pueyrredon", "av pueyrredon"],
    bounds: [
      [-58.408, -34.61],
      [-58.405, -34.58],
    ],
  },
  {
    id: "street-maipu",
    name: "Av. Maipú",
    address: "Avenida Maipú, Vicente López — Núñez",
    lat: -34.545,
    lng: -58.48,
    kind: "calle",
    aliases: ["maipu", "maipú", "avenida maipu", "av maipu"],
    bounds: [
      [-58.49, -34.56],
      [-58.47, -34.52],
    ],
  },
  {
    id: "street-panamericana",
    name: "Av. Panamericana",
    address: "Avenida Panamericana, Martínez — San Isidro",
    lat: -34.515,
    lng: -58.51,
    kind: "calle",
    aliases: ["panamericana", "avenida panamericana", "av panamericana"],
    bounds: [
      [-58.54, -34.53],
      [-58.48, -34.5],
    ],
  },
  {
    id: "street-boedo",
    name: "Av. Boedo",
    address: "Avenida Boedo, Almagro — Barracas",
    lat: -34.62,
    lng: -58.415,
    kind: "calle",
    aliases: ["boedo", "avenida boedo", "av boedo"],
    bounds: [
      [-58.416, -34.635],
      [-58.413, -34.6],
    ],
  },
  {
    id: "street-san-juan",
    name: "Av. San Juan",
    address: "Avenida San Juan, Congreso — Barracas",
    lat: -34.622,
    lng: -58.39,
    kind: "calle",
    aliases: ["san juan", "avenida san juan", "av san juan"],
    bounds: [
      [-58.41, -34.623],
      [-58.37, -34.62],
    ],
  },
  {
    id: "street-entre-rios",
    name: "Av. Entre Ríos",
    address: "Avenida Entre Ríos, Balvanera — Constitución",
    lat: -34.615,
    lng: -58.39,
    kind: "calle",
    aliases: ["entre rios", "avenida entre rios", "av entre rios"],
    bounds: [
      [-58.392, -34.63],
      [-58.387, -34.6],
    ],
  },
  {
    id: "street-lima",
    name: "Av. Lima",
    address: "Avenida Lima, Constitución",
    lat: -34.628,
    lng: -58.38,
    kind: "calle",
    aliases: ["lima", "avenida lima", "av lima"],
    bounds: [
      [-58.382, -34.632],
      [-58.377, -34.62],
    ],
  },
  {
    id: "street-figueroa",
    name: "Av. Figueroa Alcorta",
    address: "Avenida Figueroa Alcorta, Recoleta — Palermo",
    lat: -34.584,
    lng: -58.395,
    kind: "calle",
    aliases: ["figueroa alcorta", "avenida figueroa alcorta", "av figueroa"],
    bounds: [
      [-58.42, -34.586],
      [-58.37, -34.582],
    ],
  },
  {
    id: "street-alvarez-thomas",
    name: "Av. Álvarez Thomas",
    address: "Avenida Álvarez Thomas, Saavedra — Núñez",
    lat: -34.55,
    lng: -58.47,
    kind: "calle",
    aliases: ["alvarez thomas", "avenida alvarez thomas", "av alvarez thomas"],
    bounds: [
      [-58.475, -34.56],
      [-58.465, -34.54],
    ],
  },
  {
    id: "street-olla",
    name: "Av. Costanera",
    address: "Avenida Costanera, Palermo — Barracas",
    lat: -34.6,
    lng: -58.355,
    kind: "calle",
    aliases: ["costanera", "avenida costanera", "av costanera"],
    bounds: [
      [-58.36, -34.64],
      [-58.35, -34.57],
    ],
  },
];

function scoreMatch(nameNorm: string, aliasNorms: string[], q: string): number | null {
  if (!q) return 3;
  if (nameNorm === q) return 0;
  for (const a of aliasNorms) {
    if (a === q) return 0;
  }
  if (nameNorm.startsWith(q)) return 1;
  for (const a of aliasNorms) {
    if (a.startsWith(q)) return 1;
  }
  if (nameNorm.includes(q)) return 2;
  for (const a of aliasNorms) {
    if (a.includes(q)) return 2;
  }
  return null;
}

export interface GeoSearchSources {
  /** Paradas del dataset (nombre + dirección). */
  stops?: ReadonlyArray<{ id: string; name: string; address?: string; lat: number; lng: number }>;
  /** POIs / lugares ya curados en el planner. */
  pois?: ReadonlyArray<{ id?: string; name: string; address?: string; lat: number; lng: number; stopId?: string }>;
}

/**
 * Busca calles, landmarks y (opcionalmente) paradas/POIs.
 * Ranking: exacto > prefijo > incluye; landmark/calle primero que paradas.
 * Query vacía → landmarks principales.
 */
export function searchGeocode(
  query: string,
  sources: GeoSearchSources = {},
  limit = 10,
): GeoResult[] {
  const q = normalizeText(query);
  const scored: Array<{ item: GeoResult; rank: number; group: number }> = [];
  const seen = new Set<string>();

  const consider = (item: GeoResult, group: number) => {
    const nameNorm = normalizeText(item.name);
    const aliasNorms = (item.aliases ?? []).map(normalizeText);
    const addressNorm = item.address ? normalizeText(item.address) : "";
    let rank = scoreMatch(nameNorm, aliasNorms, q);
    if (rank === null && q && addressNorm.includes(q)) rank = 3;
    if (rank === null) return;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    scored.push({ item, rank: rank + group * 10, group });
  };

  // group 0: landmarks, group 1: calles, group 2: POIs, group 3: paradas
  for (const lm of LANDMARK_INDEX) consider(lm, 0);
  for (const st of STREET_INDEX) consider(st, 1);

  for (const poi of sources.pois ?? []) {
    consider(
      {
        id: poi.id ?? `poi-${poi.name}`,
        name: poi.name,
        address: poi.address ?? "",
        lat: poi.lat,
        lng: poi.lng,
        kind: "poi",
        stopId: poi.stopId,
        bounds: boundsAround(poi.lat, poi.lng, 0.003),
      },
      2,
    );
  }

  for (const stop of sources.stops ?? []) {
    consider(
      {
        id: `stop-${stop.id}`,
        name: stop.name,
        address: stop.address ?? "",
        lat: stop.lat,
        lng: stop.lng,
        kind: "parada",
        stopId: stop.id,
        bounds: boundsAround(stop.lat, stop.lng, 0.0025),
      },
      3,
    );
  }

  scored.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Convierte un GeoResult al contrato LocationPoint del planner.
 * `focusBounds` es el encuadre que MapCanvas usará en fitBounds al elegir el resultado.
 */
export function geoToLocationPoint(geo: GeoResult): LocationPoint {
  return {
    id: geo.id,
    name: geo.name,
    address: geo.address,
    lat: geo.lat,
    lng: geo.lng,
    stopId: geo.stopId,
    isArbitrary: geo.kind === "calle" || geo.kind === "direccion" || geo.kind === "landmark",
    source: "poi",
    focusBounds: geo.bounds ?? boundsAround(geo.lat, geo.lng),
  };
}
