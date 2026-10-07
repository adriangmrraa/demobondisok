'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationConsentModal } from '@/components/home/LocationConsentModal';
import { PlaceSelector } from '@/components/home/PlaceSelector';
import { AssistantWizard } from '@/components/home/AssistantWizard';
import { SIMULATED_USER_LOCATION, requestDeviceLocation } from '@/lib/config/user-location';
import { nearbyStopsFor } from '@/lib/services/assistant-intent-service';
import { useAssistantSession } from '@/hooks/use-assistant-session';
import { assistantRefFromSession } from '@/lib/assistant-session';
import { TransportService } from '@/lib/services/transport-service';
import { subscribeToPositions } from '@/mock/live';
import { useFavorites } from '@/hooks/use-favorites';
import type { NearbyStopItem } from '@/lib/services/assistant-intent-service';
import type { LocationPoint } from '@/types/trip-planner';
import type { VehiclePosition } from '@/lib/data-service';

type Phase = 'idle' | 'consent' | 'selector' | 'wizard';

/**
 * Flujo completo de "¿Cómo llego?" en una página dedicada.
 * Reusa LocationConsentModal + PlaceSelector + AssistantWizard
 * que viven en /inicio. Al confirmar el viaje, navega a /mapas
 * con la ruta trazada (origen + destino + boarding stop).
 */
export function ComoLlegoFlow() {
  const router = useRouter();
  const { session, setConsentido, setLugar, setParadaSelId, setLastQuery } = useAssistantSession();
  const { favorites } = useFavorites();
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wizardError, setWizardError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPositions(
      TransportService.getLineas().map((l) => l.id),
      setPositions,
    );
    return unsubscribe;
  }, []);

  const nearbyStops = useMemo<NearbyStopItem[]>(() => {
    const ref = assistantRefFromSession(session);
    if (!ref) return [];
    return nearbyStopsFor(
      { ref, favorites: favorites.map((f) => f.stopId), positions },
      5,
    );
  }, [session, favorites, positions]);

  const handleConsentUseReal = useCallback(async () => {
    try {
      const loc = await requestDeviceLocation();
      setConsentido(true);
      setLugar({ name: loc.name, address: loc.address, lat: loc.lat, lng: loc.lng, stopId: loc.stopId });
      setParadaSelId(null);
      setPhase('wizard');
    } catch {
      setPhase('selector');
    }
  }, [setConsentido, setLugar, setParadaSelId]);

  const handleConsentUseDemo = useCallback(() => {
    setConsentido(true);
    setLugar({
      name: SIMULATED_USER_LOCATION.name,
      address: SIMULATED_USER_LOCATION.address ?? 'Parque Centenario, CABA',
      lat: SIMULATED_USER_LOCATION.lat,
      lng: SIMULATED_USER_LOCATION.lng,
      stopId: SIMULATED_USER_LOCATION.stopId,
    });
    setParadaSelId(null);
    setPhase('wizard');
  }, [setConsentido, setLugar, setParadaSelId]);

  const handleConsentClose = useCallback(() => {
    setPhase('idle');
  }, []);

  const handlePlaceSelect = useCallback(
    (place: LocationPoint) => {
      setLugar({
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        stopId: place.stopId,
      });
      setParadaSelId(null);
      setPhase('wizard');
    },
    [setLugar, setParadaSelId],
  );

  const handlePlaceCancel = useCallback(() => {
    setPhase('idle');
  }, []);

  const handleWizardComplete = useCallback(
    (paradaId: string, destinoText: string, selectedDestination?: LocationPoint) => {
      setWizardError(null);
      setParadaSelId(paradaId);
      setLastQuery({ intent: 'trip_plan', destinoText, originStopId: paradaId });
      // Navega a /mapas con el origen y destino para que el mapa trace la ruta.
      const dest = selectedDestination ?? session.lugar;
      const params = new URLSearchParams();
      params.set('origen', dest?.name ?? destinoText);
      if (session.lugar) {
        params.set('origenLat', String(session.lugar.lat));
        params.set('origenLng', String(session.lugar.lng));
      }
      params.set('destino', destinoText);
      params.set('paradaSubida', paradaId);
      router.push(`/mapas?${params.toString()}`);
      return true;
    },
    [router, setLastQuery, setParadaSelId, session.lugar],
  );

  const handleChangeLocation = useCallback(() => {
    setPhase('selector');
  }, []);

  return (
    <>
      {phase === 'consent' ? (
        <LocationConsentModal
          onUseReal={handleConsentUseReal}
          onUseDemo={handleConsentUseDemo}
          onClose={handleConsentClose}
        />
      ) : phase === 'selector' ? (
        <PlaceSelector onSelect={handlePlaceSelect} onCancel={handlePlaceCancel} />
      ) : null}

      <AssistantWizard
        open={phase === 'wizard'}
        locationName={assistantRefFromSession(session).name}
        nearbyStops={nearbyStops}
        submissionError={wizardError}
        onChangeLocation={handleChangeLocation}
        onClose={() => setPhase('idle')}
        onComplete={handleWizardComplete}
      />
    </>
  );
}
