import type { TonoBadge } from '../../shared/components/badge/badge';

/** Domain/Enums JerarquiaEnum: nivel de la denominación (regional, tramo o unidad). */
export const JERARQUIA: Record<number, { label: string; tono: TonoBadge }> = {
  1: { label: 'Regional', tono: 'accent' },
  2: { label: 'Tramo', tono: 'primary' },
  3: { label: 'Unidad', tono: 'neutral' },
};

/** Mirrors Application/Features/Operaciones/Unidades/UnidadViewModels.cs UnidadViewModel. */
export type Unidad = {
  id: number;
  ficha: string;
  placa: string | null;
  denominacionId: number | null;
  denominacion: string;
  nivelDenominacionId: number | null;
  nivelDenominacion: string;
  tramoId: number | null;
  tramo: string;
  estaDisponible: boolean;
  isActive: boolean;
};

/** Mirrors Application/Features/Operaciones/Denominaciones/DenominacionViewModel.cs DenominacionViewModel. */
export type Denominacion = {
  id: number;
  nombre: string;
  nivelDenominacionId: number;
  nivelDenominacion: string;
  jerarquia: number;
  tramoId: number;
  tramo: string;
  /** Unidad activa que la usa ahora; null: libre. */
  unidadId: number | null;
  unidadFicha: string | null;
};

/** GET /unidades/opciones-asignacion (Unidades/GetOpcionesAsignacion.cs): solo activos. */
export type OpcionesAsignacion = {
  unidades: { id: number; ficha: string; placa: string | null; denominacionId: number | null; denominacion: string | null; estaDisponible: boolean }[];
  denominaciones: {
    id: number;
    nombre: string;
    nivelDenominacion: string;
    jerarquia: number;
    tramo: string;
    unidadId: number | null;
    unidadFicha: string | null;
  }[];
  tramos: { id: number; nombre: string }[];
  niveles: { id: number; nombre: string; jerarquia: number }[];
};

/** POST /unidades/asignar-denominacion (Unidades/AsignarDenominacion.cs AsignacionDenominacionResult). */
export type AsignacionResultado = {
  unidadId: number;
  ficha: string;
  denominacionId: number;
  denominacion: string;
  denominacionAnterior: string | null;
  unidadesLiberadas: { id: number; ficha: string }[];
};

/** Mismas reglas que Domain Unidad.FichaRegex / Unidad.PlacaRegex (se envían en mayúsculas). */
export const FICHA_VALIDA = /^[A-Z]{1,2}-\d{3,4}$/;
export const PLACA_VALIDA = /^[A-Z]{1,2}\d{5,6}$/;
export const MENSAJE_FICHA = 'Formato: 1 o 2 letras, guion y 3 o 4 números (ej.: CA-1759).';
export const MENSAJE_PLACA = 'Formato: 1 o 2 letras y 5 o 6 números (ej.: EL00101).';

/** { "NuevaUnidad.Ficha": ["..."] } de la API → { "nuevaunidad.ficha": "..." } (primer mensaje, clave en minúsculas). */
export function erroresPorClave(errors: Record<string, string[]> | null | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([clave, mensajes]) => [clave.toLowerCase(), mensajes[0]]));
}

/** POST /unidades/importar (Unidades/ImportarUnidadesDenominacion.cs ImportacionUnidadesResult). */
export type ImportacionResultado = {
  /** true: se guardó. false: vista previa, o hubo errores y no se guardó nada. */
  aplicado: boolean;
  totalFilas: number;
  conErrores: number;
  sinCambios: number;
  asignaciones: number;
  unidadesCreadas: number;
  denominacionesCreadas: number;
  filas: {
    fila: number;
    ficha: string;
    denominacion: string;
    estado: 'error' | 'sin-cambios' | 'cambios';
    unidadNueva: boolean;
    denominacionNueva: boolean;
    cambios: string[];
    errores: string[];
  }[];
  /** Unidades que no están en el archivo y pierden su denominación (quedan No disponibles). */
  unidadesSinDenominacion: { id: number; ficha: string }[];
};
