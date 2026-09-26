"use client";

import { useEffect, useRef, useState } from "react";
import { RECORRIDOS_MOCK, VEHICULOS_INICIALES_MOCK } from "@/lib/mock/amba-data";
import { VehiculoEnVivo, Vehicle } from "@/types/transport";

/**
 * Calcula el rumbo (bearing) en grados (0-360) entre dos coordenadas geográficas.
 */
function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

interface VehicleProgress {
  segmentIdx: number;
  stepRatio: number; // 0.0 a 1.0 dentro del segmento
}

/**
 * Hook cliente useLiveGPS (o useSimulatedVehicles).
 * Simula el desplazamiento de la flota a 1 Hz exclusivamente en el cliente.
 */
export function useLiveGPS(activeLineaId?: string | null) {
  const [vehiculos, setVehiculos] = useState<VehiculoEnVivo[]>(VEHICULOS_INICIALES_MOCK);
  const progressMapRef = useRef<Map<string, VehicleProgress>>(new Map());

  useEffect(() => {
    // Inicializar posiciones distribuidas para cada unidad
    VEHICULOS_INICIALES_MOCK.forEach((v, index) => {
      if (!progressMapRef.current.has(v.id)) {
        const recorrido = RECORRIDOS_MOCK.find((r) => r.lineaId === v.lineaId);
        const maxSegments = recorrido ? Math.max(1, recorrido.coordenadas.length - 1) : 1;
        progressMapRef.current.set(v.id, {
          segmentIdx: index % maxSegments,
          stepRatio: (index * 0.25) % 0.8,
        });
      }
    });

    // Un único temporizador centralizado a 1000ms (1 Hz) para bajo consumo de CPU/GPU
    const interval = setInterval(() => {
      setVehiculos((prev) =>
        prev.map((vehiculo) => {
          const recorrido = RECORRIDOS_MOCK.find((r) => r.lineaId === vehiculo.lineaId);
          if (!recorrido || recorrido.coordenadas.length < 2) return vehiculo;

          const progress = progressMapRef.current.get(vehiculo.id) || { segmentIdx: 0, stepRatio: 0 };
          const coords = recorrido.coordenadas;

          // Velocidad simulada entre 11 y 18 km/h (docs/RECORRIDOS-LINEAS.md)
          const baseStep = 0.05;
          let newStepRatio = progress.stepRatio + baseStep;
          let newSegmentIdx = progress.segmentIdx;

          if (newStepRatio >= 1.0) {
            newStepRatio = 0;
            newSegmentIdx += 1;
            if (newSegmentIdx >= coords.length - 1) {
              newSegmentIdx = 0; // Circuito cerrado / reinicio suave
            }
          }

          progressMapRef.current.set(vehiculo.id, {
            segmentIdx: newSegmentIdx,
            stepRatio: newStepRatio,
          });

          const p1 = coords[newSegmentIdx];
          const p2 = coords[newSegmentIdx + 1] || coords[0];

          // Interpolación lineal sobre la polilínea del recorrido
          const curLng = p1[0] + (p2[0] - p1[0]) * newStepRatio;
          const curLat = p1[1] + (p2[1] - p1[1]) * newStepRatio;
          const bearing = calculateBearing(p1[1], p1[0], p2[1], p2[0]);

          return {
            ...vehiculo,
            lat: curLat,
            lng: curLng,
            bearing,
            velocidadKmH: Math.floor(12 + Math.random() * 6),
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const vehiculosFiltrados = activeLineaId
    ? vehiculos.filter((v) => v.lineaId === activeLineaId)
    : vehiculos;

  return {
    vehiculos: vehiculosFiltrados,
    vehicles: vehiculosFiltrados,
    totalActivos: vehiculos.length,
  };
}

// Alias de convención en inglés
export const useSimulatedVehicles = useLiveGPS;
