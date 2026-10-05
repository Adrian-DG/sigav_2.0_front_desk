import { httpResource } from '@angular/common/http';
import { Component, computed, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import type { PagedResult } from '../../core/models/paged-result';
import { mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { JERARQUIA, type Denominacion, type Unidad } from './unidades-denominacion.model';

const TAMANO_PAGINA = 20;

type Vista = 'unidades' | 'denominaciones';

/**
 * Unidades (fichas) y denominaciones por tramo. Una sola página con dos listados: solo se pide a
 * la API el de la vista activa (GET /unidades o GET /denominaciones).
 */
@Component({
  selector: 'app-unidades-denominacion',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, Busqueda, EstadoLista, Paginador, Badge, Button, Icon],
  templateUrl: './unidades-denominacion.html',
})
export class UnidadesDenominacion {
  protected readonly JERARQUIA = JERARQUIA;
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly vistas: { valor: Vista; label: string }[] = [
    { valor: 'unidades', label: 'Unidades' },
    { valor: 'denominaciones', label: 'Denominaciones' },
  ];

  protected readonly vista = signal<Vista>('unidades');
  // Cada vista busca sobre campos distintos: al cambiar de vista la búsqueda empieza vacía
  protected readonly busqueda = linkedSignal({ source: this.vista, computation: () => '' });
  protected readonly pagina = linkedSignal({
    source: () => [this.vista(), this.busqueda()],
    computation: () => 1,
  });

  private readonly params = computed(() => {
    const params: Record<string, string | number> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.busqueda()) params['searchTerm'] = this.busqueda();
    return params;
  });

  protected readonly unidades = httpResource<PagedResult<Unidad>>(() =>
    this.vista() === 'unidades' ? { url: `${environment.apiUrl}/unidades`, params: this.params() } : undefined,
  );

  protected readonly denominaciones = httpResource<PagedResult<Denominacion>>(() =>
    this.vista() === 'denominaciones' ? { url: `${environment.apiUrl}/denominaciones`, params: this.params() } : undefined,
  );

  private readonly activo = computed(() => (this.vista() === 'unidades' ? this.unidades : this.denominaciones));

  protected readonly cargando = computed(() => this.activo().isLoading());
  protected readonly error = computed(() => mensajeDeError(this.activo().error()));

  // Mientras llega la página nueva se sigue mostrando la anterior de la misma vista
  protected readonly listaUnidades = linkedSignal<PagedResult<Unidad> | undefined, PagedResult<Unidad> | undefined>({
    source: () => (this.unidades.hasValue() ? this.unidades.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly listaDenominaciones = linkedSignal<
    PagedResult<Denominacion> | undefined,
    PagedResult<Denominacion> | undefined
  >({
    source: () => (this.denominaciones.hasValue() ? this.denominaciones.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });

  protected readonly hayDatos = computed(() =>
    this.vista() === 'unidades' ? !!this.listaUnidades()?.items.length : !!this.listaDenominaciones()?.items.length,
  );

  protected recargar(): void {
    this.activo().reload();
  }
}
