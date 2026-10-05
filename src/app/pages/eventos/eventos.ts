import { httpResource } from '@angular/common/http';
import { Component, computed, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { PagedResult } from '../../core/models/paged-result';
import { fechaHora, mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { Selector } from '../../shared/components/selector/selector';
import { EventoDetalle } from './evento-detalle/evento-detalle';
import {
  CATEGORIA_EVENTO,
  ESTADO_EVENTO,
  EstadoEvento,
  type EventoListItem,
  type FiltrosEventos,
} from './eventos.model';

const TAMANO_PAGINA = 20;

/**
 * Asistencias y accidentes reportados por las unidades (GET /eventos), más recientes primero.
 * Filtros por estado, fechas, agente, unidad, denominación, tramo y datos del ciudadano; las
 * opciones de los selectores vienen de GET /eventos/filtros. Un clic en la fila abre el detalle.
 */
@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [
    ModulePage,
    ModuloAcciones,
    ModuloFiltros,
    Filtro,
    Busqueda,
    Selector,
    EstadoLista,
    Paginador,
    Badge,
    Button,
    Icon,
    EventoDetalle,
  ],
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
  protected readonly agenteId = signal<number | null>(null);
  protected readonly unidadId = signal<number | null>(null);
  protected readonly denominacionId = signal<number | null>(null);
  protected readonly tramoId = signal<number | null>(null);
  protected readonly ciudadano = signal('');

  // Vuelve a la primera página cada vez que cambia un filtro
  protected readonly pagina = linkedSignal({
    source: () => [
      this.estado(),
      this.desde(),
      this.hasta(),
      this.agenteId(),
      this.unidadId(),
      this.denominacionId(),
      this.tramoId(),
      this.ciudadano(),
    ],
    computation: () => 1,
  });

  protected readonly hayFiltros = computed(
    () =>
      this.estado() !== null ||
      !!this.desde() ||
      !!this.hasta() ||
      this.agenteId() !== null ||
      this.unidadId() !== null ||
      this.denominacionId() !== null ||
      this.tramoId() !== null ||
      !!this.ciudadano(),
  );

  protected readonly eventos = httpResource<PagedResult<EventoListItem>>(() => {
    const params: Record<string, string | number> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.estado() !== null) params['estado'] = this.estado()!;
    if (this.desde()) params['desde'] = this.desde();
    if (this.hasta()) params['hasta'] = this.hasta();
    if (this.agenteId() !== null) params['agenteId'] = this.agenteId()!;
    if (this.unidadId() !== null) params['unidadId'] = this.unidadId()!;
    if (this.denominacionId() !== null) params['denominacionId'] = this.denominacionId()!;
    if (this.tramoId() !== null) params['tramoId'] = this.tramoId()!;
    if (this.ciudadano()) params['ciudadano'] = this.ciudadano();
    return { url: `${environment.apiUrl}/eventos`, params };
  });

  // Mientras llega la página nueva se sigue mostrando la anterior (atenuada en app-estado-lista)
  protected readonly resultado = linkedSignal<PagedResult<EventoListItem> | undefined, PagedResult<EventoListItem> | undefined>({
    source: () => (this.eventos.hasValue() ? this.eventos.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.eventos.error()));

  protected readonly filtros = httpResource<FiltrosEventos>(() => `${environment.apiUrl}/eventos/filtros`);
  protected readonly opciones = computed<FiltrosEventos>(() =>
    this.filtros.hasValue() ? this.filtros.value() : { agentes: [], unidades: [], denominaciones: [], tramos: [] },
  );

  /** Evento abierto en el diálogo de detalle. */
  protected readonly detalleId = signal<number | null>(null);

  protected cambiarEstado(valor: string): void {
    this.estado.set(valor ? (Number(valor) as EstadoEvento) : null);
  }

  protected limpiarFiltros(): void {
    this.estado.set(null);
    this.desde.set('');
    this.hasta.set('');
    this.agenteId.set(null);
    this.unidadId.set(null);
    this.denominacionId.set(null);
    this.tramoId.set(null);
    this.ciudadano.set('');
  }
}
