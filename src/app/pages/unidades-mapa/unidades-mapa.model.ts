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
  /** Nivel de la denominación (Móvil, Grúa, Taller, Ambulancia...). */
  nivel: string | null;
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

export type TipoUnidad = 'unidad' | 'grua' | 'taller';

/**
 * Ícono de cada tipo de unidad: trazos blancos sobre el círculo del color del estado
 * (viewBox 0 0 24 24, stroke-width 2).
 */
export const TIPOS: Record<TipoUnidad, { label: string; trazos: string[] }> = {
  unidad: {
    label: 'Unidad',
    // Vehículo patrulla: carrocería, ventanas y ruedas
    trazos: ['M3 16v-4l2.2-4.6A2 2 0 0 1 7 6.3h10a2 2 0 0 1 1.8 1.1L21 12v4Z', 'M3.5 12h17', 'M6 19.5v-3.5M18 19.5v-3.5'],
  },
  grua: {
    label: 'Grúa',
    // Camión con pluma y gancho
    trazos: ['M2 16v-3h10V8h4.5l3.5 4.5V16Z', 'M4 13 9 4.5V8', 'M9 8a1.5 1.5 0 1 1-1.5 1.5', 'M6 19a1.5 1.5 0 1 0 0-.01M16 19a1.5 1.5 0 1 0 0-.01'],
  },
  taller: {
    label: 'Taller',
    // Llave de mecánico
    trazos: [
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z',
    ],
  },
};

/**
 * Tipo de unidad según el nivel de su denominación (catálogo NivelDenominacion: "Grúa", "Taller"...).
 * Cualquier otro nivel (Móvil, Motorizada, Ambulancia, supervisores...) se muestra como unidad.
 */
export function tipoDeUnidad(nivel: string | null): TipoUnidad {
  const n = normalizar(nivel ?? '');
  if (n.includes('grua')) return 'grua';
  if (n.includes('taller')) return 'taller';
  return 'unidad';
}

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
