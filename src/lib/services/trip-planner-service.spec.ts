import assert from "node:assert";
import { TripPlannerService, KNOWN_POIS } from "./trip-planner-service";
import { TransitLeg } from "@/types/trip-planner";

console.log("▶ Ejecutando Suite Exhaustiva de Pruebas del Motor de Viaje (Puntos 21 y 22)...");

// =========================================================================
// Caso 1: Viaje directo (Origen arbitrario ➔ Línea ➔ Destino arbitrario)
// =========================================================================
{
  console.log("\n[Caso 1] Viaje directo con walking access y egress");
  const origin = {
    name: "Av. Cabildo 2500 (Belgrano)",
    address: "Av. Cabildo 2500",
    lat: -34.55982,
    lng: -58.45891,
    isArbitrary: true,
  };
  const dest = {
    name: "Hospital Garrahan (Acceso)",
    address: "Pichincha 1890",
    lat: -34.634219,
    lng: -58.390904,
    isArbitrary: true,
  };

  const results = TripPlannerService.planTrip(origin, dest);
  assert.ok(results.length > 0, "Debe encontrar al menos una alternativa para Cabildo 2500 ➔ Garrahan");

  const direct = results.find((r) => r.transfersCount === 0);
  assert.ok(direct, "Debe existir una alternativa directa");
  assert.strictEqual(direct.steps[0].type, "walk", "Paso 1 debe ser WALK");
  assert.strictEqual(direct.steps[1].type, "ride", "Paso 2 debe ser RIDE");
  assert.strictEqual(direct.steps[direct.steps.length - 1].type, "walk", "Último paso debe ser WALK");

  console.log(`  ✓ Encontrado: ${direct.title} (Acceso: ${direct.steps[0].distanceMeters}m a pie, Egreso: ${direct.steps[direct.steps.length - 1].distanceMeters}m a pie)`);
}

// =========================================================================
// Caso 2: Combinación descubierta algorítmicamente (Belgrano ➔ Zárate)
// =========================================================================
{
  console.log("\n[Caso 2] Combinación descubierta algorítmicamente (Barrancas de Belgrano ➔ Zárate)");
  const belgrano = KNOWN_POIS.find((p) => p.name === "Barrancas de Belgrano")!;
  const zarate = KNOWN_POIS.find((p) => p.name === "Centro de Transferencia de Zárate")!;

  const results = TripPlannerService.planTrip(belgrano, zarate);
  assert.ok(results.length > 0, "Debe encontrar alternativas hacia Zárate");

  const transferTrip = results.find((r) => r.transfersCount === 1);
  assert.ok(transferTrip, "Debe encontrar combinación de 1 transbordo");
  assert.strictEqual(transferTrip.linesInvolved.length, 2, "Deben participar 2 líneas");
  assert.strictEqual(transferTrip.linesInvolved[0].numero, "65");
  assert.strictEqual(transferTrip.linesInvolved[1].numero, "194");

  const types = transferTrip.steps.map((s) => s.type);
  assert.ok(types.includes("transfer"), "Debe contener paso transfer");
  console.log(`  ✓ Combinación descubierta: ${transferTrip.title} (${transferTrip.totalDurationMinutes} min)`);
}

// =========================================================================
// Caso 3 & 4: Walking Access y Walking Egress
// =========================================================================
{
  console.log("\n[Casos 3 y 4] Walking Access y Egress en puntos alejados");
  const arbitraryOrigin = {
    name: "Av. Cabildo 2500 (Belgrano)",
    address: "Av. Cabildo 2500",
    lat: -34.55982,
    lng: -58.45891,
    isArbitrary: true,
  };
  const constitucion = KNOWN_POIS.find((p) => p.name === "Plaza Constitución")!;

  const results = TripPlannerService.planTrip(arbitraryOrigin, constitucion);
  assert.ok(results.length > 0, "Debe encontrar alternativas para origen alejado");

  const best = results[0];
  assert.ok(best.walkDistanceMeters > 0, "La distancia a pie debe ser mayor a 0");
  assert.strictEqual(best.steps[0].type, "walk", "Debe iniciar con caminata de acceso");
  assert.strictEqual(best.steps[best.steps.length - 1].type, "walk", "Debe terminar con caminata de egreso");
  console.log(`  ✓ Acceso a pie calculado: ${best.steps[0].description}`);
  console.log(`  ✓ Egreso a pie calculado: ${best.steps[best.steps.length - 1].description}`);
}

// =========================================================================
// Caso 5: Múltiples alternativas diferenciadas sin duplicados
// =========================================================================
{
  console.log("\n[Caso 5] Múltiples alternativas no duplicadas");
  const belgrano = KNOWN_POIS.find((p) => p.name === "Barrancas de Belgrano")!;
  const zarate = KNOWN_POIS.find((p) => p.name.includes("Manuel de la Torre"))!;

  const results = TripPlannerService.planTrip(belgrano, zarate);
  assert.ok(results.length > 1, "Debe generar más de 1 alternativa cuando existen opciones directas y con combinación");

  // Verificar que los IDs y títulos no estén duplicados
  const titles = results.map((r) => r.title);
  const uniqueTitles = new Set(titles);
  assert.strictEqual(titles.length, uniqueTitles.size, "No debe haber alternativas con el mismo título/itinerario");
  console.log(`  ✓ ${results.length} alternativas distintas encontradas: ${titles.join(" | ")}`);
}

// =========================================================================
// Caso 6: Segmento de línea (recorte de geometría, no toda la línea)
// =========================================================================
{
  console.log("\n[Caso 6] Recorte estricto de geometría (segmentos utilizados vs línea entera)");
  const belgrano = KNOWN_POIS.find((p) => p.name === "Barrancas de Belgrano")!;
  const constitucion = KNOWN_POIS.find((p) => p.name === "Plaza Constitución")!;

  const results = TripPlannerService.planTrip(belgrano, constitucion);
  const trip = results[0];

  assert.ok(trip.segments.length > 0, "Debe tener segmentos geométricos");
  const rideSegment = trip.segments.find((s) => s.type === "ride");
  assert.ok(rideSegment, "Debe haber un segmento de colectivo");
  assert.ok(rideSegment.coordinates.length > 1, "El segmento debe contener coordenadas");

  console.log(`  ✓ Segmento de viaje cortado tiene ${rideSegment.coordinates.length} puntos en polilínea.`);
}

// =========================================================================
// Caso 7: Dirección correcta del recorrido
// =========================================================================
{
  console.log("\n[Caso 7] Sentido de circulación correcto (Ida vs Vuelta)");
  const constitucion = KNOWN_POIS.find((p) => p.name === "Plaza Constitución")!;
  const belgrano = KNOWN_POIS.find((p) => p.name === "Barrancas de Belgrano")!;

  // De Constitución a Belgrano debe usar sentido IDA
  const resultsIda = TripPlannerService.planTrip(constitucion, belgrano);
  const directIda = resultsIda.find((r) => r.transfersCount === 0);
  assert.ok(directIda);
  const transitLegIda = directIda.legs.find((l): l is TransitLeg => l.type === "ride");
  assert.ok(transitLegIda);
  assert.strictEqual(transitLegIda.sentido, "ida", "Debe usar sentido IDA");

  // De Belgrano a Constitución debe usar sentido VUELTA
  const resultsVuelta = TripPlannerService.planTrip(belgrano, constitucion);
  const directVuelta = resultsVuelta.find((r) => r.transfersCount === 0);
  assert.ok(directVuelta);
  const transitLegVuelta = directVuelta.legs.find((l): l is TransitLeg => l.type === "ride");
  assert.ok(transitLegVuelta);
  assert.strictEqual(transitLegVuelta.sentido, "vuelta", "Debe usar sentido VUELTA");

  console.log("  ✓ Dirección verificada: Constitución ➔ Belgrano = ida | Belgrano ➔ Constitución = vuelta.");
}

// =========================================================================
// Caso 8: Sin ruta disponible (fuera de cobertura)
// =========================================================================
{
  console.log("\n[Caso 8] Sin ruta disponible para destino fuera de cobertura");
  const belgrano = KNOWN_POIS.find((p) => p.name === "Barrancas de Belgrano")!;
  const farAway = {
    name: "Catedral de La Plata",
    lat: -34.9214,
    lng: -57.9545,
    isArbitrary: true,
  };

  const results = TripPlannerService.planTrip(belgrano, farAway);
  assert.strictEqual(results.length, 0, "No debe generar rutas hacia puntos desconectados");
  console.log("  ✓ Retorna 0 alternativas limpiamente sin inventar rutas.");
}

// =========================================================================
// Caso Especial del Meeting: Parque Centenario ➔ Hospital Durand (Decisión Caminar vs Colectivo)
// =========================================================================
{
  console.log("\n[Caso Meeting] Parque Centenario ➔ Hospital Durand (Caminar gana a Colectivo)");
  const centenario = KNOWN_POIS.find((p) => p.name === "Parque Centenario")!;
  const durand = KNOWN_POIS.find((p) => p.name === "Hospital Durand")!;

  const results = TripPlannerService.planTrip(centenario, durand);
  assert.ok(results.length > 0, "Debe resolver viaje de Centenario a Durand");

  // La mejor opción debe ser la caminata directa a pie
  const bestOption = results[0];
  assert.strictEqual(bestOption.title, "Directo a pie", "La mejor opción debe ser caminar directo");
  assert.ok(bestOption.totalDurationMinutes <= 5, "La caminata directa debe durar <= 5 minutos");
  assert.strictEqual(bestOption.transfersCount, 0);

  console.log(`  ✓ Opción recomendada #1: ${bestOption.title} (${bestOption.walkDistanceMeters} m, ${bestOption.totalDurationMinutes} min).`);
}

console.log("\n🎉 ¡Todos los 8 casos de prueba + caso especial pasaron con éxito!");
