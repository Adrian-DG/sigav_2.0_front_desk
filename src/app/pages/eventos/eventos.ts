import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AvisosService } from '../../core/services/avisos.service';
import type { PagedResult } from '../../core/models/paged-result';
import { Permisos } from '../../core/permissions/permisos';
import { fechaCorta, fechaHora, mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { MenuContextual, type OpcionMenu } from '../../shared/components/menu-contextual/menu-contextual';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { Selector } from '../../shared/components/selector/selector';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { EventoDetalle } from './evento-detalle/evento-detalle';
import { NuevoEvento, type EventoAsignado } from './nuevo-evento/nuevo-evento';
import {
  CATEGORIA_EVENTO,
  ESTADO_EVENTO,
  EstadoEvento,
  type EventoListItem,
  type FiltrosEventos,
  type OpcionFiltro,
} from './eventos.model';

const TAMANO_PAGINA = 20;

/** Filtro avanzado aplicado, mostrado como chip mientras el panel está cerrado. */
type FiltroActivo = { etiqueta: string; valor: string; quitar: () => void };

/**
 * Asistencias y accidentes reportados por las unidades (GET /eventos), más recientes primero.
 * A la vista solo la búsqueda por ciudadano; estado, fechas, agente, unidad, denominación y tramo
 * van en el panel de filtros avanzados (aplicados: chips). Las opciones de los selectores vienen
 * de GET /eventos/filtros. Un clic en la fila abre el detalle; clic derecho o ⋯, sus opciones.
 * Los filtros, la página y el evento abierto viven en la URL (estado, desde, hasta, agenteId,
 * unidadId, denominacionId, tramoId, ciudadano, pagina, evento): sobreviven a recargar, se pueden
 * compartir (p. ej. el enlace a un evento) y así abre el panel de estadísticas del inicio.
 * Con el permiso eventos.asignar, el call center crea aquí un evento y lo asigna a una unidad
 * disponible (que lo recibe como pendiente, con notificación).
 * Desde las opciones de la fila se imprime el formulario de asistencia (PDF que genera la API).
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
    MenuContextual,
    EventoDetalle,
    NuevoEvento,
    HasPermissionDirective,
  ],
  templateUrl: './eventos.html',
})
export class Eventos {
  protected readonly estados = Object.values(EstadoEvento).map((valor) => ({ valor, ...ESTADO_EVENTO[valor] }));
  protected readonly ESTADO = ESTADO_EVENTO;
  protected readonly CATEGORIA = CATEGORIA_EVENTO;
  protected readonly fechaHora = fechaHora;
  protected readonly tamano = TAMANO_PAGINA;

  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly url = this.ruta.snapshot.queryParamMap;
  private readonly http = inject(HttpClient);

  protected readonly estado = signal<EstadoEvento | null>(estadoDeUrl(this.url.get('estado')));
  protected readonly desde = signal(fechaDeUrl(this.url.get('desde')));
  protected readonly hasta = signal(fechaDeUrl(this.url.get('hasta')));
  protected readonly agenteId = signal(idDeUrl(this.url.get('agenteId')));
  protected readonly unidadId = signal(idDeUrl(this.url.get('unidadId')));
  protected readonly denominacionId = signal(idDeUrl(this.url.get('denominacionId')));
  protected readonly tramoId = signal(idDeUrl(this.url.get('tramoId')));
  protected readonly ciudadano = signal(this.url.get('ciudadano')?.trim() ?? '');

  // Vuelve a la primera página cada vez que cambia un filtro
  protected readonly pagina = linkedSignal<unknown[], number>({
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
    // Al entrar, la de la URL; después, cada cambio de filtro vuelve a la 1
    computation: (_filtros, previo) => (previo ? 1 : (idDeUrl(this.url.get('pagina')) ?? 1)),
  });

  protected readonly hayFiltros = computed(() => this.filtrosActivos().length > 0 || !!this.ciudadano());

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

  protected readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    const o = this.opciones();
    const activos: FiltroActivo[] = [];
    const porId = (etiqueta: string, lista: OpcionFiltro[], id: number | null, quitar: () => void) => {
      if (id !== null) activos.push({ etiqueta, valor: lista.find((x) => x.id === id)?.nombre ?? `#${id}`, quitar });
    };

    if (this.estado() !== null)
      activos.push({ etiqueta: 'Estado', valor: ESTADO_EVENTO[this.estado()!].label, quitar: () => this.estado.set(null) });
    if (this.desde() || this.hasta()) {
      const desde = this.desde() ? fechaCorta(this.desde()) : '…';
      const hasta = this.hasta() ? fechaCorta(this.hasta()) : '…';
      activos.push({
        etiqueta: 'Fecha',
        valor: this.desde() === this.hasta() ? desde : `${desde} – ${hasta}`,
        quitar: () => {
          this.desde.set('');
          this.hasta.set('');
        },
      });
    }
    porId('Agente', o.agentes, this.agenteId(), () => this.agenteId.set(null));
    porId('Unidad', o.unidades, this.unidadId(), () => this.unidadId.set(null));
    porId('Denominación', o.denominaciones, this.denominacionId(), () => this.denominacionId.set(null));
    porId('Tramo', o.tramos, this.tramoId(), () => this.tramoId.set(null));
    return activos;
  });

  /** Abierto de entrada si la URL ya trae filtros avanzados (p. ej. desde el panel del inicio). */
  protected readonly avanzadosAbiertos = signal(this.filtrosActivos().length > 0);

  /** Evento abierto en el diálogo de detalle. */
  protected readonly detalleId = signal<number | null>(idDeUrl(this.url.get('evento')));

  // Call center (permiso eventos.asignar): crear un evento y asignarlo a una unidad
  protected readonly permisoAsignar = Permisos.AsignarEventos;
  protected readonly nuevoEventoAbierto = signal(false);
  private readonly avisos = inject(AvisosService);

  private readonly menu = viewChild.required(MenuContextual);

  constructor() {
    // Estado de la página → URL (sin apilar historial: "Atrás" sale de Eventos, no deshace filtros)
    effect(() => {
      const queryParams: Record<string, string | number | null> = {
        estado: this.estado(),
        desde: this.desde() || null,
        hasta: this.hasta() || null,
        agenteId: this.agenteId(),
        unidadId: this.unidadId(),
        denominacionId: this.denominacionId(),
        tramoId: this.tramoId(),
        ciudadano: this.ciudadano() || null,
        pagina: this.pagina() > 1 ? this.pagina() : null,
        evento: this.detalleId(),
      };
      void this.router.navigate([], { relativeTo: this.ruta, queryParams, replaceUrl: true });
    });
  }

  /** Opciones de una fila: desde el botón ⋯ de la columna Opciones o con clic derecho sobre la fila. */
  protected abrirOpciones(evento: MouseEvent, item: EventoListItem): void {
    const opciones: OpcionMenu[] = [
      { label: 'Ver detalle', icono: 'detalle', accion: () => this.detalleId.set(item.id) },
      { label: 'Imprimir formulario (PDF)', icono: 'imprimir', accion: () => this.imprimirFormulario(item.id) },
    ];
    if (item.unidadId !== null && item.unidadId !== this.unidadId()) {
      const unidadId = item.unidadId;
      opciones.push({
        label: `Eventos de la unidad ${item.unidadFicha}`,
        icono: 'unidades',
        accion: () => this.unidadId.set(unidadId),
      });
    }
    if (item.agenteId !== null && item.agenteId !== this.agenteId()) {
      const agenteId = item.agenteId;
      opciones.push({ label: 'Eventos de este agente', icono: 'agentes', accion: () => this.agenteId.set(agenteId) });
    }
    opciones.push({
      label: 'Copiar N.º de evento',
      icono: 'copiar',
      accion: () => this.copiar(item.id),
    });
    this.menu().abrir(evento, opciones, `Evento #${item.id}`);
  }

  /**
   * Formulario de asistencia (APVI-FOR-003) del evento: se abre en otra pestaña, en el visor de PDF
   * del navegador (imprimir, guardar). Si el navegador bloquea la pestaña, se descarga.
   */
  protected imprimirFormulario(id: number): void {
    // La pestaña se abre ya, dentro del clic: abierta al llegar el PDF, el navegador la bloquearía
    const pestana = window.open('', '_blank');
    pestana?.document.write('<p style="font-family: sans-serif; padding: 24px">Generando el formulario de asistencia…</p>');

    this.http.get(`${environment.apiUrl}/eventos/${id}/reporte`, { responseType: 'blob' }).subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(pdf);
        if (pestana) {
          pestana.location.href = url;
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = `asistencia-${id}.pdf`;
          a.click();
        }
        // Margen para que la pestaña termine de cargarlo antes de liberar la URL
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) => {
        pestana?.close();
        this.avisos.error(`No se pudo generar el formulario del evento #${id}: ${mensajeDeError(error)}`);
      },
    });
  }

  private copiar(id: number): void {
    if (!navigator.clipboard) return void this.avisos.error('El navegador no permite copiar al portapapeles.');
    navigator.clipboard.writeText(String(id)).then(
      () => this.avisos.exito(`N.º de evento ${id} copiado.`),
      () => this.avisos.error('No se pudo copiar al portapapeles.'),
    );
  }

  /** El evento nuevo queda pendiente en la unidad: se avisa si recibió la notificación y se recarga el listado. */
  protected asignado(evento: EventoAsignado): void {
    this.nuevoEventoAbierto.set(false);
    const destino = `${evento.ficha || 'la unidad'}${evento.agente ? ` (${evento.agente})` : ''}`;
    this.avisos.exito(
      evento.notificada
        ? `Evento No. ${evento.id} asignado a ${destino}. La unidad recibió la notificación.`
        : `Evento No. ${evento.id} asignado a ${destino}. La unidad no tiene la app conectada: lo verá como pendiente al abrirla.`,
    );
    this.eventos.reload();
  }

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

/** Id positivo de un query param, o null si falta o no es válido. */
function idDeUrl(valor: string | null): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Estado de evento de un query param, o null si falta o no es uno conocido. */
function estadoDeUrl(valor: string | null): EstadoEvento | null {
  const estado = Number(valor) as EstadoEvento;
  return Object.values(EstadoEvento).includes(estado) ? estado : null;
}

/** Fecha yyyy-MM-dd de un query param, o vacío si falta o no tiene ese formato. */
function fechaDeUrl(valor: string | null): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : '';
}
