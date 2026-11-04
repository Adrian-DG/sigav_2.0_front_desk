import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import type { PagedResult } from '../../core/models/paged-result';
import { Permisos } from '../../core/permissions/permisos';
import { AvisosService } from '../../core/services/avisos.service';
import { fechaHora, hoyRD, mensajeDeError, sumarDias } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import {
  ESTADO_EVALUACION,
  EstadoEvaluacion,
  type BandejaCalidadItem,
  type EncuestaListItem,
} from './calidad.model';
import { EvaluarEvento } from './evaluar-evento/evaluar-evento';

const TAMANO_PAGINA = 20;
/** Días hacia atrás del filtro inicial. */
const DIAS_INICIALES = 7;

/**
 * Bandeja de calidad (GET /calidad/eventos): eventos completados y el estado de su evaluación. Por
 * defecto muestra los pendientes de la última semana. Abrir una fila lleva a la evaluación, donde se
 * contacta al ciudadano y se registra la encuesta. "Exportar" descarga el Excel de una versión de la
 * encuesta para el rango de fechas filtrado.
 */
@Component({
  selector: 'app-calidad',
  standalone: true,
  imports: [
    ModulePage,
    ModuloAcciones,
    ModuloFiltros,
    Filtro,
    Busqueda,
    EstadoLista,
    Paginador,
    Badge,
    Button,
    Icon,
    RouterLink,
    HasPermissionDirective,
    EvaluarEvento,
  ],
  templateUrl: './calidad.html',
})
export class Calidad {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(AvisosService);

  protected readonly ESTADO = ESTADO_EVALUACION;
  protected readonly estados = Object.entries(ESTADO_EVALUACION).map(([valor, e]) => ({ valor: Number(valor), label: e.label }));
  protected readonly fechaHora = fechaHora;
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly permisoEncuestas = Permisos.EncuestasCalidad;

  /** null = todos los estados. */
  protected readonly estado = signal<EstadoEvaluacion | null>(EstadoEvaluacion.Pendiente);
  protected readonly desde = signal(sumarDias(hoyRD(), -DIAS_INICIALES));
  protected readonly hasta = signal(hoyRD());
  protected readonly busqueda = signal('');
  protected readonly pagina = linkedSignal({
    source: () => [this.estado(), this.desde(), this.hasta(), this.busqueda()],
    computation: () => 1,
  });

  protected readonly hayFiltros = computed(
    () =>
      this.estado() !== EstadoEvaluacion.Pendiente ||
      !!this.busqueda() ||
      this.desde() !== sumarDias(hoyRD(), -DIAS_INICIALES) ||
      this.hasta() !== hoyRD(),
  );

  protected readonly bandeja = httpResource<PagedResult<BandejaCalidadItem>>(() => {
    const params: Record<string, string | number> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.estado() !== null) params['estado'] = this.estado()!;
    if (this.desde()) params['desde'] = this.desde();
    if (this.hasta()) params['hasta'] = this.hasta();
    if (this.busqueda()) params['ciudadano'] = this.busqueda();
    return { url: `${environment.apiUrl}/calidad/eventos`, params };
  });

  protected readonly resultado = linkedSignal<
    PagedResult<BandejaCalidadItem> | undefined,
    PagedResult<BandejaCalidadItem> | undefined
  >({
    source: () => (this.bandeja.hasValue() ? this.bandeja.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.bandeja.error()));

  /** Pendientes del rango (sin importar el filtro de estado), para el aviso. */
  private readonly pendientes = httpResource<PagedResult<BandejaCalidadItem>>(() => ({
    url: `${environment.apiUrl}/calidad/eventos`,
    params: { estado: EstadoEvaluacion.Pendiente, desde: this.desde(), hasta: this.hasta(), page: 1, size: 1 },
  }));
  protected readonly totalPendientes = computed(() => (this.pendientes.hasValue() ? this.pendientes.value().totalCount : 0));

  // ------------------------------------------------ Evaluación

  /** Evento abierto en la evaluación; null = cerrada. */
  protected readonly eventoAbierto = signal<number | null>(null);

  protected estadoDe(item: BandejaCalidadItem): EstadoEvaluacion {
    return item.estadoEvaluacion ?? EstadoEvaluacion.Pendiente;
  }

  protected cambioEnEvaluacion(): void {
    this.bandeja.reload();
    this.pendientes.reload();
  }

  // ------------------------------------------------ Exportación

  protected readonly versiones = httpResource<EncuestaListItem[]>(() => `${environment.apiUrl}/calidad/versiones`);
  /** null = la vigente. */
  protected readonly versionExportar = signal<number | null>(null);
  protected readonly exportando = signal(false);

  protected exportar(): void {
    if (this.exportando()) return;
    if (!this.desde() || !this.hasta()) {
      this.avisos.error('Indique el rango de fechas a exportar.');
      return;
    }
    this.exportando.set(true);
    const params: Record<string, string | number> = { desde: this.desde(), hasta: this.hasta() };
    if (this.versionExportar() !== null) params['encuestaId'] = this.versionExportar()!;

    this.http
      .get(`${environment.apiUrl}/calidad/exportar`, { params, responseType: 'blob', observe: 'response' })
      .subscribe({
        next: (respuesta) => {
          this.exportando.set(false);
          const nombre =
            /filename="?([^";]+)"?/.exec(respuesta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'calidad.xlsx';
          const url = URL.createObjectURL(respuesta.body!);
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => {
          this.exportando.set(false);
          this.avisos.error(mensajeDeError(error) ?? 'No se pudo exportar.');
        },
      });
  }

  // ------------------------------------------------ Filtros

  protected cambiarEstado(valor: string): void {
    this.estado.set(valor === '' ? null : (Number(valor) as EstadoEvaluacion));
  }

  protected verPendientes(): void {
    this.estado.set(EstadoEvaluacion.Pendiente);
  }

  protected limpiarFiltros(): void {
    this.estado.set(EstadoEvaluacion.Pendiente);
    this.busqueda.set('');
    this.desde.set(sumarDias(hoyRD(), -DIAS_INICIALES));
    this.hasta.set(hoyRD());
  }
}
