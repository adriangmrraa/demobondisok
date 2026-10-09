import { HomeScreen } from '@/components/home/HomeScreen';
import { buildLineCatalog } from '@/lib/home/line-catalog';

/** Inicio, variante A (imagen 1): línea primero. Ver docs/HOME-LINEA-FIRST.md. */
export default function InicioPage() {
  return <HomeScreen variant="a" catalog={buildLineCatalog()} />;
}
