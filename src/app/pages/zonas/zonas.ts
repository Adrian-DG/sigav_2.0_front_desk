import { httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Permisos } from '../../core/permissions/permisos';
import { AuthService } from '../../core/services/auth.service';
import { AvisosService } from '../../core/services/avisos.service';
import { mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { CrearZonaTramo } from './crear-zona-tramo/crear-zona-tramo';
import { REGIONES, type Creacion, type Zona } from './zonas.model';

/** Minúsculas y sin acentos: "cibao" coincide con "Cibao". */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Zonas (antes regiones de asistencia) agrupadas por región, con sus tramos (GET /zonas). Los
 * tramos son los que se eligen al crear una denominación. Con zonas.gestionar se crean zonas
 * (POST /zonas) y tramos (POST /tramos); sin él, solo consulta.
 */
@Component({
  selector: 'app-zonas',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, Busqueda, EstadoLista, Badge, Button, Icon, CrearZonaTramo],
  templateUrl: './zonas.html',
})
export class Zonas {
  private readonly auth = inject(AuthService);
  private readonly avisos = inject(AvisosService);

  protected readonly puedeGestionar = computed(() => this.auth.permisos().includes(Permisos.GestionarZonas));
  protected readonly regiones = REGIONES;

  protected readonly busqueda = signal('');
  protected readonly region = signal<number | null>(null);
  protected readonly incluirInactivos = signal(false);
  protected readonly hayFiltros = computed(() => !!this.busqueda() || this.region() !== null || this.incluirInactivos());

  // La región se filtra en el navegador: así el diálogo de tramo ofrece siempre todas las zonas
  protected readonly zonas = httpResource<Zona[]>(() => ({
    url: `${environment.apiUrl}/zonas`,
    params: { incluirInactivos: this.incluirInactivos() },
  }));

  /** Mientras recarga se sigue mostrando la lista anterior. */
  private readonly todas = linkedSignal<Zona[] | undefined, Zona[] | undefined>({
    source: () => (this.zonas.hasValue() ? this.zonas.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.zonas.error()));

  /** Zonas activas, para elegir la del tramo nuevo. */
  protected readonly zonasActivas = computed(() => (this.todas() ?? []).filter((z) => z.isActive));

  /**
   * Por región (Este, Norte, Sur), las zonas que coinciden con los filtros. Si la búsqueda coincide
   * con el nombre de la zona se muestran todos sus tramos; si no, solo los tramos que coinciden.
   */
  protected readonly grupos = computed(() => {
    const termino = normalizar(this.busqueda().trim());
    const zonas = (this.todas() ?? [])
      .filter((z) => this.region() === null || z.region === this.region())
      .map((z) => {
        if (!termino || normalizar(z.nombre).includes(termino)) return z;
        const tramos = z.tramos.filter((t) => normalizar(t.nombre).includes(termino));
        return tramos.length ? { ...z, tramos } : null;
      })
      .filter((z): z is Zona => z !== null);

    return REGIONES.map((r) => ({ ...r, zonas: zonas.filter((z) => z.region === r.valor) })).filter((g) => g.zonas.length);
  });

  protected readonly totales = computed(() => {
    const zonas = this.grupos().flatMap((g) => g.zonas);
    return { zonas: zonas.length, tramos: zonas.reduce((n, z) => n + z.tramos.length, 0) };
  });

  // ------------------------------------------------ Creación

  protected readonly creando = signal<Creacion | null>(null);

  protected nuevaZona(): void {
    this.creando.set({ tipo: 'zona' });
  }

  protected nuevoTramo(zonaId: number | null = null): void {
    this.creando.set({ tipo: 'tramo', zonaId });
  }

  protected creado(texto: string): void {
    this.creando.set(null);
    this.avisos.exito(texto);
    this.zonas.reload();
  }

  protected cambiarRegion(valor: string): void {
    this.region.set(valor ? Number(valor) : null);
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.region.set(null);
    this.incluirInactivos.set(false);
  }

  protected denominaciones(n: number): string {
    return n === 0 ? 'Sin denominaciones' : n === 1 ? '1 denominación' : `${n} denominaciones`;
  }
}
