/**
 * urban-features — Taxonomía de señales urbanas OSM (plan §8)
 *
 * Fuente de verdad compartida entre el snapshot offline (pois.json v2,
 * generado por scripts/fetch-pois.mjs) y las capas del mapa (map-canvas).
 * Los datos se descargan SOLO en build-time con Overpass; nunca en runtime.
 *
 * Aclaración de producto: la simbología es ayuda visual — la cobertura
 * de semáforos/PARE/cruces en OSM depende de la comunidad y NO es un
 * dato vial oficial ni completo. Atribución: © OpenStreetMap contributors.
 */

export type UrbanFeatureType =
  | 'traffic_signal'
  | 'stop_sign'
  | 'crossing'
  | 'station'
  | 'hospital'
  | 'place_of_worship'
  | 'supermarket'
  | 'landmark';

/** Elemento del snapshot v2 (public/data/pois.json) */
export interface UrbanFeature {
  /** `osm:{node|way|relation}:{id}` — dedupe por identidad OSM */
  id: string;
  type: UrbanFeatureType;
  /** Opcional: semáforos/PARE/cruces rara vez tienen nombre */
  name?: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  lat: number;
  lng: number;
  /** Dirección del cartel/semáforo cuando OSM la informa */
  direction?: string;
}

/** Semáforos y PARE: sólo aportan contexto en zoom de calle */
export const SIGNAL_MIN_ZOOM = 16.2;
/** Cruces peatonales: aún más cercano, para no saturar */
export const CROSSING_MIN_ZOOM = 17;

export const SIGNAL_TYPES: readonly UrbanFeatureType[] = ['traffic_signal', 'stop_sign'];
export const CROSSING_TYPES: readonly UrbanFeatureType[] = ['crossing'];
/** POIs con nombre que aparecen desde zoom medio (comportamiento existente) */
export const NAMED_POI_TYPES: readonly UrbanFeatureType[] = [
  'station',
  'hospital',
  'place_of_worship',
  'supermarket',
  'landmark',
];

export function isSignalType(type: string): boolean {
  return (SIGNAL_TYPES as readonly string[]).includes(type);
}

export function isCrossingType(type: string): boolean {
  return (CROSSING_TYPES as readonly string[]).includes(type);
}

export function isNamedPoiType(type: string): boolean {
  return (NAMED_POI_TYPES as readonly string[]).includes(type);
}

/**
 * Iconos para los tipos NUEVOS (los heredados —station, place_of_worship,
 * supermarket— siguen usando poiIconSvg en map-canvas). Misma gramática
 * visual: glifo navy sobre círculo blanco; las señales viales van SIN
 * círculo (son mobiliario de calle, aparecen a zoom 16.2+).
 */
export function urbanIconSvg(type: UrbanFeatureType): string {
  switch (type) {
    // Semáforo: vivienda navy con 3 luces (roja/ámbar/verde)
    case 'traffic_signal':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
        <rect x="36" y="16" width="24" height="56" rx="8" fill="#101D3D"/>
        <circle cx="48" cy="30" r="6" fill="#E53935"/>
        <circle cx="48" cy="46" r="6" fill="#FEA619"/>
        <circle cx="48" cy="62" r="6" fill="#71EE8A"/>
        <rect x="44" y="72" width="8" height="14" rx="3" fill="#101D3D"/>
      </svg>`;
    // PARE: octágono rojo con borde blanco — alfabeto vial universal
    case 'stop_sign':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
        <polygon points="34,14 62,14 82,34 82,62 62,82 34,82 14,62 14,34" fill="#D32F2F" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"/>
        <rect x="28" y="44" width="40" height="8" rx="4" fill="#FFFFFF"/>
      </svg>`;
    // Cruce peatonal: cebras blancas sobre placa navy (vista cenital)
    case 'crossing':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
        <rect x="18" y="18" width="60" height="60" rx="10" fill="#101D3D"/>
        <rect x="26" y="28" width="44" height="8" rx="4" fill="#FFFFFF"/>
        <rect x="26" y="44" width="44" height="8" rx="4" fill="#FFFFFF"/>
        <rect x="26" y="60" width="44" height="8" rx="4" fill="#FFFFFF"/>
      </svg>`;
    // Hospital: cruz roja sobre círculo blanco (universal, paleta del mapa)
    case 'hospital':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
        <circle cx="48" cy="48" r="38" fill="#FFFFFF" stroke="#101D3F" stroke-width="3"/>
        <rect x="42" y="26" width="12" height="44" rx="3" fill="#D32F2F"/>
        <rect x="26" y="42" width="44" height="12" rx="3" fill="#D32F2F"/>
      </svg>`;
    // Landmark curado: estrella navy sobre círculo blanco
    case 'landmark':
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="48" height="48">
        <circle cx="48" cy="48" r="38" fill="#FFFFFF" stroke="#101D3F" stroke-width="3"/>
        <path d="M48 24 L55.1 42.9 L74 43.6 L58.9 55.8 L64.1 74 L48 63.2 L31.9 74 L37.1 55.8 L22 43.6 L40.9 42.9 Z" fill="#101D3F"/>
      </svg>`;
    default:
      return '';
  }
}

/** Tipos con icono nuevo (los demás usan los iconos POI heredados) */
export const URBAN_ICON_TYPES: readonly UrbanFeatureType[] = [
  'traffic_signal',
  'stop_sign',
  'crossing',
  'hospital',
  'landmark',
];
