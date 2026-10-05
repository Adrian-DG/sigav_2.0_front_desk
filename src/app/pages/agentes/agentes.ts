import { httpResource } from '@angular/common/http';
import { Component, computed, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { INSTITUCIONES } from '../../core/models/catalogos';
import type { PagedResult } from '../../core/models/paged-result';
import { fecha, mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { AREAS_OPERATIVAS, type Agente } from './agentes.model';

const TAMANO_PAGINA = 20;

type Autorizacion = 'todos' | 'autorizados' | 'pendientes';

/** Personal operativo (GET /agentes): búsqueda por cédula o nombre y estado de autorización. */
@Component({
  selector: 'app-agentes',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, Busqueda, EstadoLista, Paginador, Badge, Button, Icon],
  templateUrl: './agentes.html',
})
export class Agentes {
  protected readonly areas = Object.entries(AREAS_OPERATIVAS).map(([valor, label]) => ({ valor: Number(valor), label }));
  protected readonly AREA = AREAS_OPERATIVAS;
  protected readonly INSTITUCION = INSTITUCIONES;
  protected readonly fecha = fecha;
  protected readonly tamano = TAMANO_PAGINA;

  protected readonly busqueda = signal('');
  protected readonly autorizacion = signal<Autorizacion>('todos');
  protected readonly area = signal<number | null>(null);
  protected readonly incluirInactivos = signal(false);
  protected readonly pagina = linkedSignal({
    source: () => [this.busqueda(), this.autorizacion(), this.area(), this.incluirInactivos()],
    computation: () => 1,
  });

  protected readonly hayFiltros = computed(
    () => !!this.busqueda() || this.autorizacion() !== 'todos' || this.area() !== null || this.incluirInactivos(),
  );

  protected readonly agentes = httpResource<PagedResult<Agente>>(() => {
    const params: Record<string, string | number | boolean> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.busqueda()) params['searchTerm'] = this.busqueda();
    if (this.autorizacion() !== 'todos') params['autorizado'] = this.autorizacion() === 'autorizados';
    if (this.area() !== null) params['areaOperativa'] = this.area()!;
    if (this.incluirInactivos()) params['incluirInactivos'] = true;
    return { url: `${environment.apiUrl}/agentes`, params };
  });

  protected readonly resultado = linkedSignal<PagedResult<Agente> | undefined, PagedResult<Agente> | undefined>({
    source: () => (this.agentes.hasValue() ? this.agentes.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.agentes.error()));

  protected cambiarArea(valor: string): void {
    this.area.set(valor ? Number(valor) : null);
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.autorizacion.set('todos');
    this.area.set(null);
    this.incluirInactivos.set(false);
  }
}
