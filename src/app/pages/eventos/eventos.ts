import { httpResource } from '@angular/common/http';
import { Component, computed, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { PagedResult } from '../../core/models/paged-result';
import { fechaHora, mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import {
  CATEGORIA_EVENTO,
  ESTADO_EVENTO,
  EstadoEvento,
  type EventoListItem,
} from './eventos.model';

const TAMANO_PAGINA = 20;

/** Asistencias y accidentes reportados por las unidades (GET /eventos), más recientes primero. */
@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, EstadoLista, Paginador, Badge, Button, Icon],
  templateUrl: './eventos.html',
})
export class Eventos {
  protected readonly estados = Object.values(EstadoEvento).map((valor) => ({ valor, ...ESTADO_EVENTO[valor] }));
  protected readonly ESTADO = ESTADO_EVENTO;
  protected readonly CATEGORIA = CATEGORIA_EVENTO;
  protected readonly fechaHora = fechaHora;
  protected readonly tamano = TAMANO_PAGINA;

  protected readonly estado = signal<EstadoEvento | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  // Vuelve a la primera página cada vez que cambia un filtro
  protected readonly pagina = linkedSignal({
    source: () => [this.estado(), this.desde(), this.hasta()],
    computation: () => 1,
  });

  protected readonly hayFiltros = computed(() => this.estado() !== null || !!this.desde() || !!this.hasta());

  protected readonly eventos = httpResource<PagedResult<EventoListItem>>(() => {
    const params: Record<string, string | number> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.estado() !== null) params['estado'] = this.estado()!;
    if (this.desde()) params['desde'] = this.desde();
    if (this.hasta()) params['hasta'] = this.hasta();
    return { url: `${environment.apiUrl}/eventos`, params };
  });

  // Mientras llega la página nueva se sigue mostrando la anterior (atenuada en app-estado-lista)
  protected readonly resultado = linkedSignal<PagedResult<EventoListItem> | undefined, PagedResult<EventoListItem> | undefined>({
    source: () => (this.eventos.hasValue() ? this.eventos.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.eventos.error()));

  protected cambiarEstado(valor: string): void {
    this.estado.set(valor ? (Number(valor) as EstadoEvento) : null);
  }

  protected limpiarFiltros(): void {
    this.estado.set(null);
    this.desde.set('');
    this.hasta.set('');
  }
}
