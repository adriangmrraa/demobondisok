import { HomeScreen } from '@/components/home/HomeScreen';
import { buildLineCatalog } from '@/lib/home/line-catalog';

/** Inicio, variante B (imagen 2): últimos viajes primero y mapa del recorrido. Ver docs/HOME-LINEA-FIRST.md. */
export default function InicioVarianteBPage() {
  return <HomeScreen variant="b" catalog={buildLineCatalog()} />;
}
