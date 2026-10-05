import type { CategoriaEvento } from '../../eventos/eventos.model';

/** Mirrors Application/Features/Estadisticas/EstadisticasViewModels.cs (GET /estadisticas/eventos). */
export type Resumen = {
  /** Eventos distintos. */
  totalEventos: number;
  porCategoria: { categoria: CategoriaEvento; total: number }[];
  /** Un evento con varios tipos cuenta en cada uno. */
  porTipo: { tipoEventoId: number; tipoEvento: string; categoria: CategoriaEvento; total: number }[];
};

export type UnidadEstadistica = { unidadId: number; ficha: string; denominacionId: number; denominacion: string; resumen: Resumen };

export type TramoEstadistica = { tramoId: number; tramo: string; resumen: Resumen; unidades: UnidadEstadistica[] };

export type RegionEstadistica = {
  regionAsistenciaId: number;
  region: string;
  regionMacro: number;
  resumen: Resumen;
  tramos: TramoEstadistica[];
};

export type Estadisticas = {
  desde: string;
  hasta: string;
  resumen: Resumen;
  regiones: RegionEstadistica[];
};

/** Domain/Enums RegionMacroEnum. */
export const REGION_MACRO: Record<number, string> = { 1: 'Este', 2: 'Norte', 3: 'Sur' };

export const total = (r: Resumen | undefined, categoria: CategoriaEvento): number =>
  r?.porCategoria.find((c) => c.categoria === categoria)?.total ?? 0;
