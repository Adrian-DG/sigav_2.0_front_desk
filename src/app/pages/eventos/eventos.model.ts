import type { TonoBadge } from '../../shared/components/badge/badge';

/** Domain/Enums EstadoEventoEnum. */
export const EstadoEvento = { Pendiente: 1, EnCurso: 2, Completado: 3 } as const;
export type EstadoEvento = (typeof EstadoEvento)[keyof typeof EstadoEvento];

/** Domain/Enums CategoriaEventoEnum. */
export const CategoriaEvento = { Asistencia: 1, Accidente: 2 } as const;
export type CategoriaEvento = (typeof CategoriaEvento)[keyof typeof CategoriaEvento];

export const ESTADO_EVENTO: Record<EstadoEvento, { label: string; tono: TonoBadge }> = {
  [EstadoEvento.Pendiente]: { label: 'Pendiente', tono: 'warning' },
  [EstadoEvento.EnCurso]: { label: 'En curso', tono: 'primary' },
  [EstadoEvento.Completado]: { label: 'Completado', tono: 'secondary' },
};

export const CATEGORIA_EVENTO: Record<CategoriaEvento, { label: string; tono: TonoBadge }> = {
  [CategoriaEvento.Asistencia]: { label: 'Asistencia', tono: 'primary' },
  [CategoriaEvento.Accidente]: { label: 'Accidente', tono: 'danger' },
};

/** Mirrors Application/Features/Operaciones/Eventos/EventoViewModels.cs EventoListItemViewModel. */
export type EventoListItem = {
  id: number;
  estado: EstadoEvento;
  tipos: string[];
  categorias: CategoriaEvento[];
  ciudadanoPrincipal: string | null;
  vehiculoDescripcion: string | null;
  direccion: string | null;
  fechaHoraReporte: string;
  unidadFicha: string;
  unidadDenominacion: string;
};
