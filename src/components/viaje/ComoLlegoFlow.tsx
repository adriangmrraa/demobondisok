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
import { TripPlannerService } from '@/lib/services/trip-planner-service';
import { buildTripJourneyUrl } from '@/lib/trip-map-navigation';
import type { NearbyStopItem } from '@/lib/services/assistant-intent-service';
import type { LocationPoint } from '@/types/trip-planner';
import type { VehiclePosition } from '@/lib/data-service';

type Phase = 'idle' | 'consent' | 'selector' | 'wizard';

interface ComoLlegoFlowProps {
  /**
   * Señal externa de inicio: la página incrementa el nonce en cada tap a
   * "Empezar". El flujo ajusta su fase durante el render (patrón React
   * "adjusting state on prop change", igual que AssistantWizard.wasOpen).
   */
  startNonce: number;
}

/**
 * Flujo completo de "¿Cómo llego?" en una página dedicada.
 * Reusa LocationConsentModal + PlaceSelector + AssistantWizard
 * que viven en /inicio. Al confirmar el viaje, planifica con
 * TripPlannerService y navega a /viaje con las alternativas
 * (trip=1 + origen + parada de subida + destino).
 */
export function ComoLlegoFlow({ startNonce }: ComoLlegoFlowProps) {
  const router = useRouter();
  const { session, setConsentido, setLugar, setParadaSelId, setLastQuery } = useAssistantSession();
  const { favorites } = useFavorites();
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Ajuste de estado durante el render: cada nuevo nonce reabre el flujo en
  // la fase que corresponde a la sesión actual (nunca queda en 'idle').
  const [lastStartNonce, setLastStartNonce] = useState(startNonce);
  if (startNonce !== lastStartNonce) {
    setLastStartNonce(startNonce);
    setWizardError(null);
    setPhase(
      !session.consentido ? 'consent' : session.lugar ? 'wizard' : 'selector',
    );
  }

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
      // Mismo handoff que /inicio: el viaje sale de la parada elegida y abre
      // las alternativas en /viaje (texto primero, nunca el mapa directo).
      const options = TripPlannerService.planTrip(paradaId, selectedDestination ?? destinoText);
      const trip =
        options.find((option) =>
          option.legs.some((leg) => leg.type === 'ride' && leg.fromStop.id === paradaId),
        ) ?? options[0];
      if (!trip) {
        setWizardError(
          'No encontramos un colectivo para ese destino desde esta parada. Probá con otra parada u otro destino.',
        );
        return false;
      }
      setPhase('idle');
      router.push(buildTripJourneyUrl(trip, trip.origin, { boardingStopId: paradaId }));
      return true;
    },
    [router, setLastQuery, setParadaSelId],
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
