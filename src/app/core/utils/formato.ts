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

/** Hoy en RD como yyyy-MM-dd (el día operativo con que la API filtra desde/hasta). */
export function hoyRD(): string {
  // en-CA formatea como yyyy-MM-dd
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_RD });
}

/** Suma (o resta) días a una fecha yyyy-MM-dd, sin pasar por la zona horaria del navegador. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas yyyy-MM-dd, contando ambas (1 si son iguales). */
export function diasDelRango(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
}

/** "5 oct" / "lun 5 oct" para una fecha yyyy-MM-dd (sin cambiar de día por la zona del navegador). */
export function fechaCorta(fecha: string, conDia = false): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-DO', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(conDia ? { weekday: 'short' } : {}),
  });
}
