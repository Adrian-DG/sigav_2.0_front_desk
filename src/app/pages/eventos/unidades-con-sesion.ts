import { httpResource } from '@angular/common/http';
import { DestroyRef, computed, inject, linkedSignal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { mensajeDeError } from '../../core/utils/formato';
import type { UnidadDisponibilidad } from './asignacion.model';

/** Las unidades cambian de disponibilidad al recibir o cerrar eventos: se refresca seguido. */
const INTERVALO_ACTUALIZACION_MS = 15_000;

/**
 * Unidades con sesión abierta en la app y si pueden recibir un evento (GET /asignaciones/unidades),
 * solo mientras el diálogo está abierto y refrescadas cada 15 s. Durante cada recarga se sigue
 * mostrando la lista anterior; al cerrar se descarta. Se llama en el constructor del diálogo.
 */
export function unidadesConSesion(abierto: () => boolean) {
  const recurso = httpResource<UnidadDisponibilidad[]>(() =>
    abierto() ? `${environment.apiUrl}/asignaciones/unidades` : undefined,
  );
  const datos = linkedSignal<{ abierto: boolean; nuevo?: UnidadDisponibilidad[] }, UnidadDisponibilidad[] | undefined>({
    source: () => ({ abierto: abierto(), nuevo: recurso.hasValue() ? recurso.value() : undefined }),
    computation: ({ abierto, nuevo }, previo) => (abierto ? (nuevo ?? previo?.value) : undefined),
  });

  const recargar = setInterval(() => {
    if (abierto() && document.visibilityState === 'visible' && !recurso.isLoading()) recurso.reload();
  }, INTERVALO_ACTUALIZACION_MS);
  inject(DestroyRef).onDestroy(() => clearInterval(recargar));

  return {
    lista: computed(() => datos() ?? []),
    cargando: computed(() => recurso.isLoading() && !datos()),
    error: computed(() => mensajeDeError(recurso.error())),
    recargar: () => recurso.reload(),
  };
}
