import { httpResource } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { describirAgente, type UnidadDisponibilidad } from '../eventos/asignacion.model';
import { normalizar } from '../unidades-mapa/unidades-mapa.model';
import { EnviarNotificacion, type InicioNotificacion } from './enviar-notificacion';
import type { EnviarNotificacionResult } from './notificaciones.model';

/** La conexión de cada unidad cambia cuando abre o cierra la app: se refresca seguido. */
const INTERVALO_ACTUALIZACION_MS = 15_000;

/**
 * Mensajes del centro de operaciones a las unidades en campo (permiso unidades.notificar). Lista
 * las unidades con sesión abierta en la app (GET /notificaciones/unidades) y si tienen las
 * notificaciones conectadas; desde aquí se envía a todas las conectadas, a varias o a una sola.
 */
@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Busqueda, EstadoLista, Badge, Button, Icon, EnviarNotificacion],
  templateUrl: './notificaciones.html',
})
export class Notificaciones {
  protected readonly describirAgente = describirAgente;

  protected readonly recurso = httpResource<UnidadDisponibilidad[]>(() => `${environment.apiUrl}/notificaciones/unidades`);
  // Durante cada recarga se siguen mostrando las unidades anteriores
  protected readonly datos = linkedSignal<UnidadDisponibilidad[] | undefined, UnidadDisponibilidad[] | undefined>({
    source: () => (this.recurso.hasValue() ? this.recurso.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly todas = computed(() => this.datos() ?? []);
  protected readonly error = computed(() => mensajeDeError(this.recurso.error()));

  protected readonly soloConectadas = signal(false);
  protected readonly busqueda = signal('');

  protected readonly conteo = computed(() => {
    const todas = this.todas();
    return { total: todas.length, conectadas: todas.filter((u) => u.conectadaNotificaciones).length };
  });

  protected readonly unidades = computed(() => {
    const texto = normalizar(this.busqueda());
    return this.todas().filter(
      (u) =>
        (!this.soloConectadas() || u.conectadaNotificaciones) &&
        (!texto || normalizar(`${u.ficha} ${u.denominacion ?? ''} ${u.tramo ?? ''} ${u.agentes.map((a) => a.nombre).join(' ')}`).includes(texto)),
    );
  });

  protected readonly notificacion = signal<InicioNotificacion | null>(null);
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    const recargar = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.recurso.isLoading()) this.recurso.reload();
    }, INTERVALO_ACTUALIZACION_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(recargar));
  }

  protected enviada(resultado: EnviarNotificacionResult): void {
    this.notificacion.set(null);
    const n = resultado.unidadesConectadas;
    this.aviso.set(
      n === 0
        ? 'Notificación enviada, pero ninguna de las unidades tenía la app conectada.'
        : `Notificación enviada a ${n} ${n === 1 ? 'unidad conectada' : 'unidades conectadas'}.`,
    );
  }
}
