/** Browser geolocation helpers. They never substitute demo coordinates. */
export interface UserLocation {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  stopId?: string;
  isSimulated: boolean;
  /** Heading del usuario en grados (0=Norte, 90=Este). Solo disponible si el dispositivo lo provee. */
  heading?: number | null;
  /** Velocidad del usuario en m/s. Solo disponible si el dispositivo lo provee. */
  speed?: number | null;
}

export const SIMULATED_USER_LOCATION: UserLocation = {
  lat: -34.604463,
  lng: -58.434711,
  name: 'Parque Centenario',
  address: 'Av. Díaz Vélez y Leopoldo Marechal, CABA',
  isSimulated: true,
  // Heading simulado hacia el sur (camina desde Parque Centenario hacia el centro)
  heading: 180,
  speed: 1.2,
};

export const SIMULATED_LOCATION_LABEL = 'Parque Centenario';

export type DeviceLocationErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class DeviceLocationError extends Error {
  constructor(public readonly code: DeviceLocationErrorCode, message: string) {
    super(message);
    this.name = 'DeviceLocationError';
  }
}

/** Must be called from a user gesture so iOS and Android can show their native prompt. */
export function requestDeviceLocation(): Promise<UserLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new DeviceLocationError('unsupported', 'Este navegador no permite usar ubicación real.'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: coords.latitude,
        lng: coords.longitude,
        name: 'Ubicación actual',
        isSimulated: false,
        heading: coords.heading ?? null,
        speed: coords.speed ?? null,
      }),
      (error) => {
        const code: DeviceLocationErrorCode =
          error.code === error.PERMISSION_DENIED ? 'denied' :
          error.code === error.TIMEOUT ? 'timeout' : 'unavailable';
        const message = code === 'denied'
          ? 'No autorizaste tu ubicación. Podés usar Parque Centenario.'
          : code === 'timeout'
            ? 'La ubicación tardó demasiado. Probá de nuevo o usá Parque Centenario.'
            : 'No pudimos obtener tu ubicación. Probá de nuevo o usá Parque Centenario.';
        reject(new DeviceLocationError(code, message));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

export function getUserLocation(): UserLocation {
  return SIMULATED_USER_LOCATION;
}
