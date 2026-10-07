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
  /** Agente de la unidad principal (rango, nombre y apellido). */
  agente: string | null;
  tramo: string | null;
  /** Todas las personas y vehículos del evento, el principal incluido. */
  totalPersonas: number;
  totalVehiculos: number;
  /** Unidad principal y su agente (para filtrar el listado por ellos). */
  unidadId: number | null;
  agenteId: number | null;
};

/** Opción de un filtro (Application/Features/Operaciones/Eventos/GetFiltrosEventos.cs). */
export type OpcionFiltro = { id: number; nombre: string; detalle: string | null };

/** GET /eventos/filtros */
export type FiltrosEventos = {
  agentes: OpcionFiltro[];
  unidades: OpcionFiltro[];
  denominaciones: OpcionFiltro[];
  tramos: OpcionFiltro[];
};

/** Domain/Enums CanalReporteEnum. */
export const CANAL_REPORTE: Record<number, string> = {
  1: 'Call center',
  2: 'Agente en campo (app)',
  3: 'Agencia 911',
  4: 'WhatsApp',
  5: 'Call center *511',
};

/** Domain/Enums RolUnidadEventoEnum. */
export const ROL_UNIDAD: Record<number, string> = { 1: 'Principal', 2: 'Apoyo', 3: 'Apoyo solicitado' };

/** Domain/Enums RolCiudadanoEnum. */
export const ROL_CIUDADANO: Record<number, string> = {
  1: 'Conductor',
  2: 'Pasajero',
  3: 'Peatón',
  4: 'Paciente',
  5: 'Otro',
};

/** Domain/Enums SexoEnum. */
export const SEXO: Record<number, string> = { 0: '—', 1: 'Masculino', 2: 'Femenino' };

/** Domain/Enums TipoEvidenciaEnum. */
export const TIPO_EVIDENCIA: Record<number, string> = {
  1: 'Foto',
  2: 'Firma del ciudadano',
  3: 'Firma del agente',
  4: 'Foto de la placa',
  5: 'Foto de la cédula',
};

/** Mirrors EventoViewModels.cs EventoDetalleViewModel (GET /eventos/{id}). */
export type EventoDetalle = {
  id: number;
  requestId: string | null;
  estado: EstadoEvento;
  canalReporte: number;
  tipoCierreId: number | null;
  tipoCierre: string | null;
  isActive: boolean;
  latitud: number;
  longitud: number;
  direccion: string | null;
  municipioId: number;
  municipio: string;
  provincia: string;
  tramoId: number | null;
  tramo: string | null;
  comentario: string | null;
  fechaHoraReporte: string;
  fechaHoraLlegada: string | null;
  fechaHoraCompletado: string | null;
  tipos: { id: number; nombre: string; categoria: CategoriaEvento }[];
  unidades: {
    unidadId: number;
    ficha: string;
    denominacionId: number;
    denominacion: string;
    nivelDenominacion: string;
    rol: number;
    agenteId: number;
    agente: string;
  }[];
  vehiculos: {
    id: number;
    placa: string | null;
    tipoVehiculo: string | null;
    marca: string | null;
    modelo: string | null;
    color: string | null;
    descripcion: string;
    /** Tipos atendidos al vehículo (ids de `tipos`). */
    tipoEventoIds: number[];
  }[];
  ciudadanos: {
    id: number;
    rol: number;
    identificacion: string | null;
    nombre: string | null;
    apellido: string | null;
    sexo: number;
    /** Años al momento del evento. */
    edad?: number | null;
    telefono: string | null;
    nacionalidad: string | null;
    vehiculoId: number | null;
    /** Tipos atendidos a la persona (ids de `tipos`); vacío = comparte los de su vehículo. */
    tipoEventoIds: number[];
  }[];
  /** El archivo: GET /eventos/{id}/evidencias/{evidenciaId}/archivo. */
  evidencias: {
    id: number;
    tipo: number;
    contentType: string;
    tamanoBytes: number;
    ciudadanoId: number | null;
    vehiculoId: number | null;
    registrada: string;
  }[];
  createdAt: string;
};
