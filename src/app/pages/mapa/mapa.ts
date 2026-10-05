import { httpResource } from '@angular/common/http';
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
import { diasDelRango, fechaCorta, fechaHora, hoyRD, mensajeDeError, sumarDias } from '../../core/utils/formato';
import { Button } from '../../shared/components/button/button';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { CategoriaEvento } from '../eventos/eventos.model';

/** Mirrors Application/Features/Operaciones/Eventos/GetMapaEventos.cs. */
type Punto = {
  id: number;
  latitud: number;
  longitud: number;
  categorias: CategoriaEvento[];
  tipos: string[];
  fechaHoraReporte: string;
  ficha: string | null;
};
type MapaEventos = { desde: string; hasta: string; total: number; truncado: boolean; puntos: Punto[] };

type Periodo = 'hoy' | '7d' | '30d' | 'mes' | 'personalizado';
type Rango = { desde: string; hasta: string };

/** Leaflet con el plugin leaflet.heat ya cargado (agrega L.heatLayer). */
type LeafletConHeat = typeof Leaflet;

/** República Dominicana: vista inicial y la del botón "Todo el país". */
const LIMITES_RD: Leaflet.LatLngBoundsExpression = [
  [17.45, -72.05],
  [19.98, -68.3],
];
const MAX_DIAS = 366;

/** Colores de las capas (mismos tonos que danger y primary del tema). */
const COLOR = { accidente: '#d92d20', asistencia: '#05539b' };
const GRADIENTE = {
  accidente: { 0.2: '#fde2e1', 0.45: '#f97066', 0.7: '#d92d20', 1: '#7a1a12' },
  asistencia: { 0.2: '#d5e2ee', 0.45: '#4680b5', 0.7: '#05539b', 1: '#022544' },
};

/**
 * Mapa de calor de los eventos (GET /eventos/mapa) con Leaflet + leaflet.heat: una capa de calor
 * para accidentes (rojo) y otra para asistencias (azul), que se pueden mostrar u ocultar, y la
 * opción de ver cada evento como un punto con su detalle. Teselas de OpenStreetMap.
 */
@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [ModulePage, ModuloAcciones, ModuloFiltros, Filtro, Button, Icon],
  templateUrl: './mapa.html',
})
export class Mapa {
  protected readonly fechaCorta = fechaCorta;
  protected readonly COLOR = COLOR;
  protected readonly gradienteCss = {
    accidente: `linear-gradient(90deg, ${Object.values(GRADIENTE.accidente).join(', ')})`,
    asistencia: `linear-gradient(90deg, ${Object.values(GRADIENTE.asistencia).join(', ')})`,
  };
  protected readonly periodos: { valor: Periodo; label: string }[] = [
    { valor: 'hoy', label: 'Hoy' },
    { valor: '7d', label: '7 días' },
    { valor: '30d', label: '30 días' },
    { valor: 'mes', label: 'Este mes' },
    { valor: 'personalizado', label: 'Personalizado' },
  ];

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('mapa');

  protected readonly hoy = signal(hoyRD());
  protected readonly periodo = signal<Periodo>('30d');
  protected readonly desdePersonalizado = signal(sumarDias(hoyRD(), -89));
  protected readonly hastaPersonalizado = signal(hoyRD());

  protected readonly verAccidentes = signal(true);
  protected readonly verAsistencias = signal(true);
  protected readonly verPuntos = signal(false);

  protected readonly rango = computed<Rango>(() => {
    const hoy = this.hoy();
    switch (this.periodo()) {
      case 'hoy':
        return { desde: hoy, hasta: hoy };
      case '7d':
        return { desde: sumarDias(hoy, -6), hasta: hoy };
      case '30d':
        return { desde: sumarDias(hoy, -29), hasta: hoy };
      case 'mes':
        return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
      case 'personalizado':
        return { desde: this.desdePersonalizado(), hasta: this.hastaPersonalizado() };
    }
  });

  protected readonly errorRango = computed(() => {
    const { desde, hasta } = this.rango();
    if (!desde || !hasta) return 'Elija ambas fechas.';
    if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final.';
    if (diasDelRango(desde, hasta) > MAX_DIAS) return `El rango no puede exceder ${MAX_DIAS} días.`;
    return null;
  });

  protected readonly mapaEventos = httpResource<MapaEventos>(() =>
    this.errorRango() ? undefined : { url: `${environment.apiUrl}/eventos/mapa`, params: this.rango() },
  );
  // Mientras llega el período nuevo se sigue mostrando el anterior
  protected readonly datos = linkedSignal<MapaEventos | undefined, MapaEventos | undefined>({
    source: () => (this.mapaEventos.hasValue() ? this.mapaEventos.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.mapaEventos.error()));

  protected readonly conteo = computed(() => {
    const puntos = this.datos()?.puntos ?? [];
    return {
      total: puntos.length,
      accidentes: puntos.filter((p) => p.categorias.includes(CategoriaEvento.Accidente)).length,
      asistencias: puntos.filter((p) => p.categorias.includes(CategoriaEvento.Asistencia)).length,
    };
  });

  // ------------------------------------------------ Leaflet

  /** Se carga al montar la vista (no se descarga Leaflet en otras páginas). */
  protected readonly cargandoMapa = signal(true);
  protected readonly errorMapa = signal<string | null>(null);
  private L: LeafletConHeat | null = null;
  private mapa: Leaflet.Map | null = null;
  private capas: Leaflet.Layer[] = [];
  private readonly listo = signal(false);

  constructor() {
    afterNextRender(() => void this.iniciarMapa());
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());

    // Redibuja las capas cuando cambian los datos o lo que se quiere ver
    effect(() => {
      if (!this.listo()) return;
      this.dibujar(this.datos()?.puntos ?? [], {
        accidentes: this.verAccidentes(),
        asistencias: this.verAsistencias(),
        puntos: this.verPuntos(),
      });
    });
  }

  protected elegirPeriodo(periodo: Periodo): void {
    this.hoy.set(hoyRD());
    this.periodo.set(periodo);
  }

  protected verTodoElPais(): void {
    this.mapa?.fitBounds(LIMITES_RD);
  }

  /** Encuadra los eventos visibles (o el país si no hay). */
  protected ajustarAEventos(): void {
    if (!this.mapa || !this.L) return;
    const puntos = this.puntosVisibles(this.datos()?.puntos ?? [], this.verAccidentes(), this.verAsistencias());
    if (!puntos.length) return this.verTodoElPais();
    this.mapa.fitBounds(this.L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud] as Leaflet.LatLngTuple)), {
      padding: [40, 40],
      maxZoom: 14,
    });
  }

  private async iniciarMapa(): Promise<void> {
    try {
      // leaflet.heat es un script clásico que extiende el L global: primero Leaflet, luego el plugin
      const modulo = await import('leaflet');
      const L = ((modulo as unknown as { default?: LeafletConHeat }).default ?? modulo) as LeafletConHeat;
      (window as unknown as { L: LeafletConHeat }).L = L;
      await import('leaflet.heat');

      this.L = L;
      this.mapa = L.map(this.contenedor().nativeElement, {
        preferCanvas: true, // miles de puntos: canvas en lugar de un elemento SVG por punto
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
      this.listo.set(true);
    } catch {
      this.errorMapa.set('No se pudo cargar el mapa.');
    } finally {
      this.cargandoMapa.set(false);
    }
  }

  private puntosVisibles(puntos: Punto[], accidentes: boolean, asistencias: boolean): Punto[] {
    return puntos.filter(
      (p) =>
        (accidentes && p.categorias.includes(CategoriaEvento.Accidente)) ||
        (asistencias && p.categorias.includes(CategoriaEvento.Asistencia)),
    );
  }

  private dibujar(puntos: Punto[], ver: { accidentes: boolean; asistencias: boolean; puntos: boolean }): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;

    for (const capa of this.capas) mapa.removeLayer(capa);
    this.capas = [];

    const calor = (categoria: CategoriaEvento, gradiente: Record<number, string>) =>
      L.heatLayer(
        puntos.filter((p) => p.categorias.includes(categoria)).map((p) => [p.latitud, p.longitud, 1] as Leaflet.HeatLatLngTuple),
        // maxZoom: zoom en que cada punto pesa completo; por debajo se atenúa. Con 10 las zonas
        // calientes ya se notan con todo el país a la vista (zoom 7-8).
        { radius: 24, blur: 20, maxZoom: 10, minOpacity: 0.3, gradient: gradiente },
      );

    // Asistencias debajo y accidentes encima: los accidentes quedan siempre visibles
    if (ver.asistencias) this.capas.push(calor(CategoriaEvento.Asistencia, GRADIENTE.asistencia));
    if (ver.accidentes) this.capas.push(calor(CategoriaEvento.Accidente, GRADIENTE.accidente));

    if (ver.puntos) {
      const marcadores = this.puntosVisibles(puntos, ver.accidentes, ver.asistencias).map((p) => {
        const esAccidente = p.categorias.includes(CategoriaEvento.Accidente);
        return L.circleMarker([p.latitud, p.longitud], {
          radius: 5,
          weight: 1,
          color: '#ffffff',
          fillColor: esAccidente ? COLOR.accidente : COLOR.asistencia,
          fillOpacity: 0.9,
        }).bindPopup(() => this.popup(p));
      });
      this.capas.push(L.layerGroup(marcadores));
    }

    for (const capa of this.capas) capa.addTo(mapa);
  }

  /** Contenido del popup de un punto (como nodos DOM, sin HTML interpolado). */
  private popup(p: Punto): HTMLElement {
    const div = document.createElement('div');
    div.className = 'text-sm';
    const linea = (texto: string, clase = '') => {
      const el = document.createElement('p');
      el.textContent = texto;
      if (clase) el.className = clase;
      div.appendChild(el);
    };
    linea(`Evento #${p.id}`, 'font-bold');
    linea(p.tipos.join(', ') || 'Sin tipo');
    linea(fechaHora(p.fechaHoraReporte), 'text-neutral-500');
    if (p.ficha) linea(`Unidad ${p.ficha}`, 'text-neutral-500');
    return div;
  }
}
