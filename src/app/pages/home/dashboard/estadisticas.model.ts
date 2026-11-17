import type { CategoriaEvento } from '../../eventos/eventos.model';

/** Mirrors Application/Features/Estadisticas/EstadisticasViewModels.cs (GET /estadisticas/eventos). */
export type Resumen = {
  /** Eventos distintos. */
  totalEventos: number;
  porCategoria: { categoria: CategoriaEvento; total: number }[];
  /** Un evento con varios tipos cuenta en cada uno. */
  porTipo: { tipoEventoId: number; tipoEvento: string; categoria: CategoriaEvento; total: number }[];
  tiempos: Tiempos;
};

/**
 * Tiempos de respuesta en minutos (null: sin eventos medibles). Llegada = reporte → llegada, solo
 * eventos despachados (no los que reporta el agente ya en el lugar); atención = llegada → completado.
 * Cumplimiento = llegadas dentro de la meta / (medidas + pendientes que ya superaron la meta).
 */
export type Tiempos = {
  llegadasMedidas: number;
  llegadaPromedioMinutos: number | null;
  llegadaMedianaMinutos: number | null;
  llegadaP90Minutos: number | null;
  atencionesMedidas: number;
  atencionPromedioMinutos: number | null;
  atencionMedianaMinutos: number | null;
  dentroDeMeta: number;
  fueraDeMeta: number;
  pendientesVencidos: number;
  cumplimientoPorcentaje: number | null;
};

export type UnidadEstadistica = { unidadId: number; ficha: string; denominacionId: number; denominacion: string; resumen: Resumen };

export type TramoEstadistica = { tramoId: number; tramo: string; resumen: Resumen; unidades: UnidadEstadistica[] };

export type ZonaEstadistica = {
  zonaId: number;
  zona: string;
  regionMacro: number;
  resumen: Resumen;
  tramos: TramoEstadistica[];
};

export type Estadisticas = {
  desde: string;
  hasta: string;
  resumen: Resumen;
  zonas: ZonaEstadistica[];
  /** Meta de llegada por categoría (minutos). */
  metas: { accidenteMinutos: number; asistenciaMinutos: number };
};

/** Domain/Enums RegionMacroEnum. */
export const REGION_MACRO: Record<number, string> = { 1: 'Este', 2: 'Norte', 3: 'Sur' };

export const total = (r: Resumen | undefined, categoria: CategoriaEvento): number =>
  r?.porCategoria.find((c) => c.categoria === categoria)?.total ?? 0;

/** "12 min", "1 h 05 min"; "—" sin dato. */
export function minutos(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const total = Math.round(valor);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
