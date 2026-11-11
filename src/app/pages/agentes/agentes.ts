import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Permisos } from '../../core/permissions/permisos';
import { AuthService } from '../../core/services/auth.service';
import { AvisosService } from '../../core/services/avisos.service';
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
import { AREAS_OPERATIVAS, type Agente, type ImportacionAgentesResultado } from './agentes.model';
import { EditarAgente } from './editar-agente/editar-agente';
import { ImportarAgentes } from './importar-agentes/importar-agentes';

const TAMANO_PAGINA = 20;

type Autorizacion = 'todos' | 'autorizados' | 'pendientes';


/**
 * Personal operativo (GET /agentes): búsqueda por cédula o nombre y estado de autorización.
 * El interruptor de cada fila autoriza o quita el acceso a la app (PATCH /agentes/{id}/autorizacion);
 * al quitarlo, la API rechaza de inmediato la sesión que el agente tenga abierta. "Editar" cambia
 * sus datos, rango o especialidad (PUT /agentes/{id}). "Cargar Excel" crea o actualiza agentes en
 * bloque (POST /agentes/importar).
 */
@Component({
  selector: 'app-agentes',
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
    EditarAgente,
    ImportarAgentes,
  ],
  templateUrl: './agentes.html',
})
export class Agentes {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Alta, edición, autorización, desactivación e importación (agentes.gestionar); sin él, solo consulta. */
  protected readonly puedeGestionar = computed(() => this.auth.permisos().includes(Permisos.GestionarAgentes));

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

  /** Agentes activos sin autorizar (p. ej. registrados desde la app), para el acceso directo. */
  protected readonly pendientes = httpResource<PagedResult<Agente>>(() => ({
    url: `${environment.apiUrl}/agentes`,
    params: { autorizado: false, page: 1, size: 1 },
  }));
  protected readonly totalPendientes = computed(() => (this.pendientes.hasValue() ? this.pendientes.value().totalCount : 0));

  // ------------------------------------------------ Autorización y edición

  /** Ids con un cambio de autorización en curso (su interruptor queda deshabilitado). */
  protected readonly cambiando = signal<ReadonlySet<number>>(new Set());
  private readonly avisos = inject(AvisosService);
  protected readonly editando = signal<Agente | null>(null);
  protected readonly importando = signal(false);

  protected alternarAutorizacion(agente: Agente): void {
    this.cambiarAutorizacion(agente, !agente.autorizado, true);
  }

  private cambiarAutorizacion(agente: Agente, autorizado: boolean, permitirDeshacer: boolean): void {
    if (this.cambiando().has(agente.id)) return;
    this.cambiando.update((s) => new Set(s).add(agente.id));

    this.http.patch(`${environment.apiUrl}/agentes/${agente.id}/autorizacion`, { autorizado }).subscribe({
      next: () => {
        this.terminarCambio(agente.id);
        const nombre = `${agente.nombre} ${agente.apellido}`;
        this.avisos.exito(
          autorizado
            ? `Se autorizó a ${nombre}: ya puede iniciar sesión en la app.`
            : `Se quitó el acceso a ${nombre}: ya no puede usar la app (si tenía una sesión abierta, se cerrará).`,
          permitirDeshacer
            ? { label: 'Deshacer', ejecutar: () => this.cambiarAutorizacion(agente, !autorizado, false) }
            : undefined,
        );
      },
      error: (error: unknown) => {
        this.terminarCambio(agente.id);
        this.avisos.error(mensajeDeError(error) ?? 'No se pudo cambiar la autorización.');
      },
    });
  }

  private terminarCambio(id: number): void {
    this.cambiando.update((s) => {
      const nuevo = new Set(s);
      nuevo.delete(id);
      return nuevo;
    });
    this.agentes.reload();
    this.pendientes.reload();
  }

  protected guardado(texto: string): void {
    this.editando.set(null);
    this.avisos.exito(texto);
    this.agentes.reload();
  }

  protected abrirImportacion(): void {
    this.importando.set(true);
  }

  protected importado(r: ImportacionAgentesResultado): void {
    this.importando.set(false);
    const partes = [`Carga aplicada: ${r.totalFilas} filas.`];
    if (r.agentesCreados) partes.push(`${r.agentesCreados} agentes nuevos.`);
    if (r.agentesActualizados) partes.push(`${r.agentesActualizados} actualizados.`);
    if (r.sinCambios) partes.push(`${r.sinCambios} sin cambios.`);
    this.avisos.exito(partes.join(' '));
    this.agentes.reload();
    this.pendientes.reload();
  }

  protected verPendientes(): void {
    this.limpiarFiltros();
    this.autorizacion.set('pendientes');
  }

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
