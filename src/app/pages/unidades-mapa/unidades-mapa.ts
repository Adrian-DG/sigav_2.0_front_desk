import { HttpClient, httpResource } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import { environment } from '../../../environments/environment';
import { fechaHora, mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../shared/components/dialogo/dialogo';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import {
  ESTADOS,
  EstadoPosicion,
  TIPOS,
  hace,
  normalizar,
  tipoDeUnidad,
  type PosicionUnidad,
  type PosicionesUnidades,
} from './unidades-mapa.model';

const SVG = 'http://www.w3.org/2000/svg';

/** República Dominicana: vista inicial y la del botón "Todo el país". */
const LIMITES_RD: Leaflet.LatLngBoundsExpression = [
  [17.45, -72.05],
  [19.98, -68.3],
];

/** La app envía cada ~30 s; con 15 s el mapa queda a lo sumo un envío atrás. */
const INTERVALO_ACTUALIZACION_MS = 15_000;

type Aviso = { texto: string; error?: boolean };

/**
 * Ubicación de las unidades (GET /unidades/posiciones), que la app móvil envía mientras el agente
 * tiene la sesión abierta. Se actualiza sola cada 15 s. Cada unidad sale con su último estado:
 * en línea, sin señal (se muestra su última posición conocida) o desconectada (cerró sesión o lleva
 * 15 min sin enviar). "Liberar sesión" permite que otro agente inicie sesión con la unidad.
 */
@Component({
  selector: 'app-unidades-mapa',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, Busqueda, Badge, Button, Icon, Dialogo, DialogoAcciones],
  templateUrl: './unidades-mapa.html',
})
export class UnidadesMapa {
  private readonly http = inject(HttpClient);

  protected readonly ESTADOS = ESTADOS;
  protected readonly TIPOS = TIPOS;
  protected readonly tipoDeUnidad = tipoDeUnidad;
  protected readonly tipos = Object.keys(TIPOS) as (keyof typeof TIPOS)[];
  protected readonly Estado = EstadoPosicion;
  protected readonly fechaHora = fechaHora;
  protected readonly redondear = Math.round;
  protected readonly estados = [EstadoPosicion.EnLinea, EstadoPosicion.SinSenal, EstadoPosicion.Desconectada];

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('mapa');

  // ------------------------------------------------ Datos

  protected readonly posiciones = httpResource<PosicionesUnidades>(() => `${environment.apiUrl}/unidades/posiciones`);
  // Durante cada recarga se siguen mostrando las posiciones anteriores
  protected readonly datos = linkedSignal<PosicionesUnidades | undefined, PosicionesUnidades | undefined>({
    source: () => (this.posiciones.hasValue() ? this.posiciones.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.posiciones.error()));

  /** Hora actual según el reloj del servidor (para "hace X min" sin depender del reloj del equipo). */
  private desfaseMs = 0;
  protected readonly ahora = signal(Date.now());

  // ------------------------------------------------ Filtros

  protected readonly visibles = signal<ReadonlySet<EstadoPosicion>>(new Set([EstadoPosicion.EnLinea, EstadoPosicion.SinSenal]));
  protected readonly tramoId = signal<number | null>(null);
  protected readonly busqueda = signal('');

  protected readonly tramos = computed(() => {
    const tramos = new Map<number, string>();
    for (const u of this.datos()?.unidades ?? []) if (u.tramoId !== null) tramos.set(u.tramoId, u.tramo ?? '');
    return [...tramos].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  protected readonly conteo = computed(() => {
    const conteo = { [EstadoPosicion.EnLinea]: 0, [EstadoPosicion.SinSenal]: 0, [EstadoPosicion.Desconectada]: 0 };
    for (const u of this.datos()?.unidades ?? []) conteo[u.estado]++;
    return conteo;
  });

  protected readonly unidades = computed(() => {
    const visibles = this.visibles();
    const tramoId = this.tramoId();
    const texto = normalizar(this.busqueda());
    return (this.datos()?.unidades ?? []).filter(
      (u) =>
        visibles.has(u.estado) &&
        (tramoId === null || u.tramoId === tramoId) &&
        (!texto || normalizar(`${u.ficha} ${u.denominacion ?? ''} ${u.agente} ${u.placa ?? ''}`).includes(texto)),
    );
  });

  protected readonly hayFiltros = computed(
    () => this.visibles().size !== 2 || !this.visibles().has(EstadoPosicion.EnLinea) || this.tramoId() !== null || !!this.busqueda(),
  );

  protected readonly seleccionada = signal<number | null>(null);

  // ------------------------------------------------ Liberar sesión

  protected readonly porLiberar = signal<PosicionUnidad | null>(null);
  protected readonly liberando = signal(false);
  protected readonly aviso = signal<Aviso | null>(null);

  // ------------------------------------------------ Leaflet

  protected readonly cargandoMapa = signal(true);
  protected readonly errorMapa = signal<string | null>(null);
  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private readonly marcadores = new Map<number, { marcador: Leaflet.Marker; unidad: PosicionUnidad }>();
  private readonly listo = signal(false);
  private encuadrado = false;

  constructor() {
    afterNextRender(() => void this.iniciarMapa());

    // Actualización automática (solo con la pestaña visible) y reloj de "hace X"
    const recargar = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.posiciones.isLoading()) this.posiciones.reload();
    }, INTERVALO_ACTUALIZACION_MS);
    const reloj = setInterval(() => this.ahora.set(Date.now() + this.desfaseMs), 5_000);
    const alVolver = () => document.visibilityState === 'visible' && this.posiciones.reload();
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(recargar);
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      this.mapa?.remove();
    });

    effect(() => {
      const datos = this.datos();
      if (!datos) return;
      this.desfaseMs = Date.parse(datos.servidorUtc) - Date.now();
      this.ahora.set(Date.now() + this.desfaseMs);
    });

    // Sincroniza los marcadores con las unidades filtradas
    effect(() => {
      if (!this.listo()) return;
      this.dibujar(this.unidades(), this.seleccionada());
    });
  }

  protected hace(u: PosicionUnidad): string {
    return hace(Date.parse(u.fechaHoraRecibidaUtc), this.ahora());
  }

  protected alternarEstado(estado: EstadoPosicion, visible: boolean): void {
    this.visibles.update((s) => {
      const nuevo = new Set(s);
      if (visible) nuevo.add(estado);
      else nuevo.delete(estado);
      return nuevo;
    });
  }

  protected cambiarTramo(valor: string): void {
    this.tramoId.set(valor ? Number(valor) : null);
  }

  protected limpiarFiltros(): void {
    this.visibles.set(new Set([EstadoPosicion.EnLinea, EstadoPosicion.SinSenal]));
    this.tramoId.set(null);
    this.busqueda.set('');
  }

  /** Centra el mapa en la unidad y abre su detalle. */
  protected enfocar(u: PosicionUnidad): void {
    this.seleccionada.set(u.unidadId);
    if (!this.mapa) return;
    this.mapa.flyTo([u.latitud, u.longitud], Math.max(this.mapa.getZoom(), 14), { duration: 0.6 });
    this.marcadores.get(u.unidadId)?.marcador.openPopup();
  }

  protected verTodoElPais(): void {
    this.mapa?.fitBounds(LIMITES_RD);
  }

  /** Encuadra las unidades visibles (o el país si no hay). */
  protected encuadrarUnidades(): void {
    if (!this.mapa || !this.L) return;
    const unidades = this.unidades();
    if (!unidades.length) return this.verTodoElPais();
    this.mapa.fitBounds(this.L.latLngBounds(unidades.map((u) => [u.latitud, u.longitud] as Leaflet.LatLngTuple)), {
      padding: [48, 48],
      maxZoom: 14,
    });
  }

  protected liberar(): void {
    const u = this.porLiberar();
    if (!u || this.liberando()) return;
    this.liberando.set(true);
    this.http.post(`${environment.apiUrl}/unidades/${u.unidadId}/liberar-sesion`, null).subscribe({
      next: () => {
        this.liberando.set(false);
        this.porLiberar.set(null);
        this.aviso.set({ texto: `Se cerró la sesión de ${u.agente} en la unidad ${u.ficha}: otro agente ya puede iniciar sesión con ella.` });
        this.posiciones.reload();
      },
      error: (error: unknown) => {
        this.liberando.set(false);
        this.porLiberar.set(null);
        this.aviso.set({ texto: mensajeDeError(error) ?? 'No se pudo liberar la sesión.', error: true });
      },
    });
  }

  private async iniciarMapa(): Promise<void> {
    try {
      const modulo = await import('leaflet');
      const L = ((modulo as unknown as { default?: typeof Leaflet }).default ?? modulo) as typeof Leaflet;
      this.L = L;
      this.mapa = L.map(this.contenedor().nativeElement, {
        zoomSnap: 0.5,
        minZoom: 7,
        maxBounds: L.latLngBounds([
          [16.5, -73.5],
          [21, -67],
        ]),
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.mapa);
      this.mapa.fitBounds(LIMITES_RD);
      this.mapa.on('popupclose', () => this.seleccionada.set(null));
      this.listo.set(true);
    } catch {
      this.errorMapa.set('No se pudo cargar el mapa.');
    } finally {
      this.cargandoMapa.set(false);
    }
  }

  /** Mueve, agrega o quita marcadores en lugar de redibujarlos todos (el popup abierto se conserva). */
  private dibujar(unidades: PosicionUnidad[], seleccionada: number | null): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;

    const ids = new Set(unidades.map((u) => u.unidadId));
    for (const [id, { marcador }] of this.marcadores) {
      if (!ids.has(id)) {
        marcador.remove();
        this.marcadores.delete(id);
      }
    }

    for (const u of unidades) {
      const icono = L.divIcon({
        html: this.icono(u, u.unidadId === seleccionada),
        className: '', // sin el fondo blanco por defecto de leaflet-div-icon
        iconSize: [0, 0],
      });
      // Las unidades en línea quedan encima de las demás
      const zIndexOffset = (3 - u.estado) * 1000 + (u.unidadId === seleccionada ? 10_000 : 0);
      const existente = this.marcadores.get(u.unidadId);
      if (existente) {
        existente.unidad = u;
        existente.marcador.setLatLng([u.latitud, u.longitud]).setIcon(icono).setZIndexOffset(zIndexOffset);
        if (existente.marcador.isPopupOpen()) existente.marcador.setPopupContent(this.popup(u));
      } else {
        const marcador = L.marker([u.latitud, u.longitud], { icon: icono, zIndexOffset, keyboard: true, title: `Unidad ${u.ficha}` })
          .bindPopup(() => this.popup(this.marcadores.get(u.unidadId)?.unidad ?? u), { offset: [0, -10] })
          .on('click', () => this.seleccionada.set(u.unidadId))
          .addTo(mapa);
        this.marcadores.set(u.unidadId, { marcador, unidad: u });
      }
    }

    // Primera carga con unidades: encuadrarlas
    if (!this.encuadrado && unidades.length) {
      this.encuadrado = true;
      this.encuadrarUnidades();
    }
  }

  /**
   * Ícono del tipo de unidad (unidad, grúa o taller) en un círculo del color del estado, flecha con
   * el rumbo (si se está moviendo) y la ficha debajo.
   */
  private icono(u: PosicionUnidad, seleccionada: boolean): HTMLElement {
    const color = ESTADOS[u.estado].color;
    const raiz = document.createElement('div');
    raiz.className = 'relative';

    const enMovimiento = u.estado === EstadoPosicion.EnLinea && u.rumbo !== null && (u.velocidadKmh ?? 0) >= 3;
    if (enMovimiento) {
      const flecha = document.createElementNS(SVG, 'svg');
      flecha.setAttribute('viewBox', '0 0 24 24');
      flecha.setAttribute('class', 'absolute h-[52px] w-[52px]');
      flecha.style.transform = `translate(-50%, -50%) rotate(${u.rumbo}deg)`;
      const punta = document.createElementNS(SVG, 'path');
      punta.setAttribute('d', 'M12 0.5 15.5 5.5H8.5Z');
      punta.setAttribute('fill', color);
      flecha.appendChild(punta);
      raiz.appendChild(flecha);
    }

    const circulo = document.createElement('div');
    circulo.className =
      'absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-md';
    circulo.style.background = color;
    if (seleccionada) circulo.style.boxShadow = `0 0 0 4px ${color}55`;
    circulo.appendChild(this.svgTipo(tipoDeUnidad(u.nivel)));
    raiz.appendChild(circulo);

    const etiqueta = document.createElement('span');
    etiqueta.className =
      'absolute top-[18px] -translate-x-1/2 rounded-md bg-white/95 px-1.5 py-px text-[11px] font-extrabold whitespace-nowrap shadow';
    etiqueta.style.color = color;
    etiqueta.textContent = u.ficha;
    raiz.appendChild(etiqueta);
    return raiz;
  }

  private svgTipo(tipo: keyof typeof TIPOS): SVGSVGElement {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'h-[18px] w-[18px]');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#ffffff');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of TIPOS[tipo].trazos) {
      const trazo = document.createElementNS(SVG, 'path');
      trazo.setAttribute('d', d);
      svg.appendChild(trazo);
    }
    return svg;
  }

  /** Contenido del popup (como nodos DOM, sin HTML interpolado). */
  private popup(u: PosicionUnidad): HTMLElement {
    const div = document.createElement('div');
    div.className = 'min-w-48 text-sm';
    const linea = (texto: string, clase = '') => {
      const el = document.createElement('p');
      el.textContent = texto;
      el.className = `!m-0 ${clase}`;
      div.appendChild(el);
    };
    linea(`${u.nivel ?? TIPOS[tipoDeUnidad(u.nivel)].label} ${u.ficha}${u.placa ? ` · ${u.placa}` : ''}`, 'font-extrabold');
    linea(u.denominacion ? `${u.denominacion}${u.tramo ? ` · ${u.tramo}` : ''}` : 'Sin denominación', 'text-neutral-600');
    linea(`${u.rango ? `${u.rango} ` : ''}${u.agente}`, 'mt-1');
    const estado = `${ESTADOS[u.estado].label} · ${hace(Date.parse(u.fechaHoraRecibidaUtc), this.ahora())}`;
    linea(estado, 'mt-1 font-bold');
    div.lastElementChild?.setAttribute('style', `color: ${ESTADOS[u.estado].color}`);
    const detalles = [
      u.velocidadKmh !== null ? `${Math.round(u.velocidadKmh)} km/h` : null,
      u.precisionMetros !== null ? `±${Math.round(u.precisionMetros)} m` : null,
    ].filter(Boolean);
    if (detalles.length) linea(detalles.join(' · '), 'text-neutral-500');
    linea(`Lectura: ${fechaHora(u.fechaHoraGpsUtc)}`, 'text-neutral-500');
    return div;
  }
}
