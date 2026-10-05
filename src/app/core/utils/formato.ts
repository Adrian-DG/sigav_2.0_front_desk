import { ApiError } from '../models/api-error';

/** Zona horaria operativa de la API (Domain ZonaHorariaOperativa): todo se muestra en hora de RD. */
const ZONA_RD = 'America/Santo_Domingo';

/**
 * La API guarda las fechas en UTC; si el valor llega sin zona (SQLite devuelve DateTime sin
 * Kind) se interpreta como UTC, no como hora local del navegador.
 */
function aFecha(valor: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(valor) ? valor : `${valor}Z`);
}

export function fechaHora(valor: string): string {
  return aFecha(valor).toLocaleString('es-DO', {
    timeZone: ZONA_RD,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fecha(valor: string): string {
  return aFecha(valor).toLocaleDateString('es-DO', {
    timeZone: ZONA_RD,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Mensaje para mostrar de un error de httpResource (ApiError, ver error.interceptor). */
export function mensajeDeError(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
}
