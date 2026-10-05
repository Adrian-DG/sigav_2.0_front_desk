/** Mirrors Domain/Enums/EstadoPosicionEnum.cs. */
export enum EstadoPosicion {
  EnLinea = 1,
  SinSenal = 2,
  Desconectada = 3,
}

/** Mirrors Application/Features/Operaciones/Posiciones/GetPosicionesUnidades.cs. */
export type PosicionUnidad = {
  unidadId: number;
  ficha: string;
  placa: string | null;
  denominacionId: number | null;
  denominacion: string | null;
  tramoId: number | null;
  tramo: string | null;
  agenteId: number;
  agente: string;
  rango: string;
  latitud: number;
  longitud: number;
  precisionMetros: number | null;
  rumbo: number | null;
  velocidadKmh: number | null;
  fechaHoraGpsUtc: string;
  fechaHoraRecibidaUtc: string;
  estado: EstadoPosicion;
};

export type PosicionesUnidades = { servidorUtc: string; unidades: PosicionUnidad[] };

export const ESTADOS: Record<EstadoPosicion, { label: string; color: string; tono: 'secondary' | 'warning' | 'neutral' }> = {
  [EstadoPosicion.EnLinea]: { label: 'En línea', color: '#006a39', tono: 'secondary' },
  [EstadoPosicion.SinSenal]: { label: 'Sin señal', color: '#d09100', tono: 'warning' },
  [EstadoPosicion.Desconectada]: { label: 'Desconectada', color: '#5b6472', tono: 'neutral' },
};

/** "hace 40 s", "hace 3 min", "hace 2 h" entre dos instantes (ms). */
export function hace(desdeMs: number, ahoraMs: number): string {
  const s = Math.max(0, Math.round((ahoraMs - desdeMs) / 1000));
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** Para buscar sin importar mayúsculas ni tildes. */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
