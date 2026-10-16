import type { CategoriaEvento } from './eventos.model';
import type { EstadoPosicion } from '../unidades-mapa/unidades-mapa.model';

/** Mirrors Application/Features/Operaciones/Asignaciones/DisponibilidadUnidades.cs AgenteDisponibilidadViewModel. */
export type AgenteDisponibilidad = {
  agenteId: number;
  nombre: string;
  rango: string;
  esComponente: boolean;
  disponible: boolean;
  /** Evento del servidor que atiende. */
  eventoId: number | null;
  /** Atiende un evento que la app aún tiene en el dispositivo (sin enviar). */
  ocupadoEnDispositivo: boolean;
};

/** GET /asignaciones/unidades (y /notificaciones/unidades): unidades con sesión abierta en la app, disponibles primero. */
export type UnidadDisponibilidad = {
  unidadId: number;
  ficha: string;
  denominacion: string | null;
  tramo: string | null;
  estado: EstadoPosicion;
  /** Tiene la app conectada a las notificaciones: recibe el aviso al momento. */
  conectadaNotificaciones: boolean;
  latitud: number;
  longitud: number;
  fechaHoraRecibidaUtc: string;
  /** Al menos uno de sus agentes (el de la sesión o su componente) está libre. */
  disponible: boolean;
  eventosActivos: number;
  agentes: AgenteDisponibilidad[];
};

/** POST /asignaciones/eventos */
export type AsignarEventoRequest = {
  latitud: number;
  longitud: number;
  municipioId: number;
  tipoEventoIds: number[];
  unidadId: number;
  agenteId: number | null;
  tramoId: number | null;
  direccion: string | null;
  comentario: string | null;
  canalReporte: number;
};

export type AsignarEventoResult = { id: number; unidadId: number; agenteId: number; notificada: boolean };

/** GET /catalogos/tipos-evento */
export type TipoEventoItem = { id: number; nombre: string; categoria: CategoriaEvento };
/** GET /catalogos/provincias y /catalogos/provincias/{id}/municipios */
export type CatalogoItem = { id: number; nombre: string };

/** Canales con que el call center registra un evento (CanalReporteEnum sin "Agente en campo"). */
export const CANALES_ASIGNACION = [
  { id: 1, nombre: 'Call center' },
  { id: 5, nombre: 'Call center 511' },
  { id: 3, nombre: 'Agencia 911' },
  { id: 4, nombre: 'WhatsApp' },
] as const;

export const DIRECCION_MAX = 250;
export const COMENTARIO_MAX = 2000;

/** Qué atiende el agente ("Libre" si nada). */
export const ocupacionAgente = (a: AgenteDisponibilidad) =>
  a.eventoId !== null ? `Evento No. ${a.eventoId}` : a.ocupadoEnDispositivo ? 'Evento en la app' : 'Libre';

export const describirAgente = (a: AgenteDisponibilidad) => `${a.rango ? `${a.rango} ` : ''}${a.nombre}`.trim();

/** Distancia en km entre dos puntos (haversine): para ordenar las unidades por cercanía al evento. */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

