import { HttpClient, httpResource } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, linkedSignal, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { diasDelRango, fechaCorta, hoyRD, mensajeDeError, sumarDias } from '../../../core/utils/formato';
import { Icon } from '../../../shared/components/icon/icon';
import { CategoriaEvento } from '../../eventos/eventos.model';
import {
  type Estadisticas,
  REGION_MACRO,
  type Resumen,
  total,
} from './estadisticas.model';

type Periodo = 'hoy' | 'ayer' | '7d' | 'mes' | 'personalizado';
type Rango = { desde: string; hasta: string };

/** Nivel del desglose: todas las regiones → una región → uno de sus tramos. */
type Seleccion = { regionId: number | null; tramoId: number | null };

/** Fila del desglose (región, tramo o unidad). */
type Fila = {
  clave: string;
  nombre: string;
  detalle: string;
  resumen: Resumen;
  /** Al hacer clic se baja un nivel (null en las unidades, el último). */
  bajar: Seleccion | null;
  /** Filtro para abrir el módulo Eventos (null: el módulo no filtra por región). */
  filtroEventos: Record<string, number> | null;
};

const REFRESCO_MS = 60_000;
const DIAS_TENDENCIA = 7;
const MAX_DIAS = 366;
const TOP_TIPOS = 8;
const TOP_UNIDADES = 8;

/** Radio y circunferencia de la dona (SVG de 120×120). */
const RADIO = 48;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Panel de estadísticas de eventos del inicio. Todo sale de GET /estadisticas/eventos (front desk
 * ve todas las regiones):
 * - el período elegido y el anterior de igual duración (para comparar);
 * - un día por petición para la tendencia de los últimos 7 días.
 * El desglose región → tramo → unidad se recorre en el navegador (la respuesta ya lo trae) y
 * filtra todo el panel. Se actualiza solo cada minuto mientras la pestaña está visible.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, Icon, NgTemplateOutlet],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/estadisticas/eventos`;

  protected readonly CATEGORIA = CategoriaEvento;
  protected readonly total = total;
  protected readonly circunferencia = CIRCUNFERENCIA;
  protected readonly radio = RADIO;
  protected readonly fechaCorta = fechaCorta;
  protected readonly periodos: { valor: Periodo; label: string }[] = [
    { valor: 'hoy', label: 'Hoy' },
    { valor: 'ayer', label: 'Ayer' },
    { valor: '7d', label: 'Últimos 7 días' },
    { valor: 'mes', label: 'Este mes' },
    { valor: 'personalizado', label: 'Personalizado' },
  ];

  /** Se recalcula en cada refresco: el panel abierto pasada la medianoche cambia de día solo. */
  protected readonly hoy = signal(hoyRD());
  protected readonly periodo = signal<Periodo>('hoy');
  protected readonly desdePersonalizado = signal(sumarDias(hoyRD(), -29));
  protected readonly hastaPersonalizado = signal(hoyRD());

  protected readonly rango = computed<Rango>(() => {
    const hoy = this.hoy();
    switch (this.periodo()) {
      case 'hoy':
        return { desde: hoy, hasta: hoy };
      case 'ayer':
        return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
      case '7d':
        return { desde: sumarDias(hoy, -6), hasta: hoy };
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

  /** Período anterior de igual duración, justo antes del elegido. */
  private readonly rangoAnterior = computed<Rango>(() => {
    const { desde, hasta } = this.rango();
    const dias = diasDelRango(desde, hasta);
    return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
  });

  protected readonly comparadoCon = computed(() => {
    switch (this.periodo()) {
      case 'hoy':
        return 'ayer';
      case 'ayer':
        return 'anteayer';
      case '7d':
        return 'los 7 días anteriores';
      default: {
        const { desde, hasta } = this.rangoAnterior();
        return `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
      }
    }
  });

  private readonly actual = httpResource<Estadisticas>(() =>
    this.errorRango() ? undefined : { url: this.url, params: this.rango() },
  );
  private readonly anterior = httpResource<Estadisticas>(() =>
    this.errorRango() ? undefined : { url: this.url, params: this.rangoAnterior() },
  );
  /** Un día por petición (el endpoint no devuelve series por día). */
  private readonly tendencia = resource({
    params: () => ({ hoy: this.hoy() }),
    loader: ({ params }) =>
      Promise.all(
        Array.from({ length: DIAS_TENDENCIA }, (_, i) => sumarDias(params.hoy, i - DIAS_TENDENCIA + 1)).map((dia) =>
          firstValueFrom(this.http.get<Estadisticas>(this.url, { params: { desde: dia, hasta: dia } })),
        ),
      ),
  });

  // Mientras llega la respuesta nueva se sigue mostrando la anterior (sin parpadeos al refrescar)
  protected readonly datos = linkedSignal<Estadisticas | undefined, Estadisticas | undefined>({
    source: () => (this.actual.hasValue() ? this.actual.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  private readonly datosAnteriores = linkedSignal<Estadisticas | undefined, Estadisticas | undefined>({
    source: () => (this.anterior.hasValue() ? this.anterior.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  private readonly dias = linkedSignal<Estadisticas[] | undefined, Estadisticas[] | undefined>({
    source: () => (this.tendencia.hasValue() ? this.tendencia.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });

  protected readonly cargando = computed(() => this.actual.isLoading());
  protected readonly error = computed(() => mensajeDeError(this.actual.error()));
  protected readonly actualizado = signal<Date | null>(null);
  protected readonly autoRefresco = signal(true);

  // ------------------------------------------------ Desglose (filtra todo el panel)

  protected readonly seleccion = signal<Seleccion>({ regionId: null, tramoId: null });

  /** Nombres para las migas: se buscan en los datos actuales. */
  protected readonly migas = computed(() => {
    const { regionId, tramoId } = this.seleccion();
    const region = this.datos()?.regiones.find((r) => r.regionAsistenciaId === regionId);
    const tramo = region?.tramos.find((t) => t.tramoId === tramoId);
    return { region: region?.region ?? null, tramo: tramo?.tramo ?? null };
  });

  protected readonly resumen = computed(() => resumenDe(this.datos(), this.seleccion()));
  private readonly resumenAnterior = computed(() => resumenDe(this.datosAnteriores(), this.seleccion()));

  protected readonly kpis = computed(() => {
    const r = this.resumen();
    const a = this.resumenAnterior();
    const kpi = (valor: number, previo: number | null) => ({ valor, previo, variacion: variacion(valor, previo) });
    const totalEventos = r?.totalEventos ?? 0;
    return {
      total: kpi(totalEventos, a ? a.totalEventos : null),
      accidentes: kpi(total(r, CategoriaEvento.Accidente), a ? total(a, CategoriaEvento.Accidente) : null),
      asistencias: kpi(total(r, CategoriaEvento.Asistencia), a ? total(a, CategoriaEvento.Asistencia) : null),
      unidades: this.unidadesConEventos().length,
    };
  });

  /** Dona por categoría. Un evento puede ser de ambas: la suma puede superar el total. */
  protected readonly dona = computed(() => {
    const r = this.resumen();
    const asistencias = total(r, CategoriaEvento.Asistencia);
    const accidentes = total(r, CategoriaEvento.Accidente);
    const suma = asistencias + accidentes;
    const largo = (n: number) => (suma ? (n / suma) * CIRCUNFERENCIA : 0);
    return {
      asistencias,
      accidentes,
      suma,
      // Segmentos con stroke-dasharray: el de accidentes empieza donde termina el de asistencias
      tramoAsistencias: `${largo(asistencias)} ${CIRCUNFERENCIA}`,
      tramoAccidentes: `${largo(accidentes)} ${CIRCUNFERENCIA}`,
      desfaseAccidentes: -largo(asistencias),
      pctAccidentes: suma ? Math.round((accidentes / suma) * 100) : 0,
    };
  });

  protected readonly tipos = computed(() => {
    const porTipo = [...(this.resumen()?.porTipo ?? [])].sort((a, b) => b.total - a.total);
    const max = porTipo[0]?.total ?? 0;
    return {
      top: porTipo.slice(0, TOP_TIPOS).map((t) => ({ ...t, ancho: max ? (t.total / max) * 100 : 0 })),
      resto: Math.max(0, porTipo.length - TOP_TIPOS),
    };
  });

  /** Últimos 7 días (siempre hasta hoy), dentro del nivel elegido del desglose. */
  protected readonly serie = computed(() => {
    const dias = this.dias() ?? [];
    const sel = this.seleccion();
    const puntos = dias.map((d) => {
      const r = resumenDe(d, sel);
      return {
        fecha: d.desde,
        total: r?.totalEventos ?? 0,
        accidentes: total(r, CategoriaEvento.Accidente),
        asistencias: total(r, CategoriaEvento.Asistencia),
      };
    });
    const max = Math.max(1, ...puntos.map((p) => p.total));
    return puntos.map((p) => ({
      ...p,
      alto: (p.total / max) * 100,
      // Proporción de accidentes dentro de la barra (la suma de categorías puede superar el total)
      parteAccidentes: p.accidentes + p.asistencias ? (p.accidentes / (p.accidentes + p.asistencias)) * 100 : 0,
      esHoy: p.fecha === this.hoy(),
    }));
  });
  protected readonly cargandoTendencia = computed(() => this.tendencia.isLoading() && !this.dias());

  /** Filas del nivel actual del desglose, de más a menos eventos. */
  protected readonly filas = computed<Fila[]>(() => {
    const datos = this.datos();
    if (!datos) return [];
    const { regionId, tramoId } = this.seleccion();
    const region = datos.regiones.find((r) => r.regionAsistenciaId === regionId);
    const tramo = region?.tramos.find((t) => t.tramoId === tramoId);

    let filas: Fila[];
    if (tramo) {
      filas = tramo.unidades.map((u) => ({
        clave: `${u.unidadId}-${u.denominacionId}`,
        nombre: u.ficha,
        detalle: u.denominacion,
        resumen: u.resumen,
        bajar: null,
        filtroEventos: { unidadId: u.unidadId },
      }));
    } else if (region) {
      filas = region.tramos.map((t) => ({
        clave: `${t.tramoId}`,
        nombre: t.tramo,
        detalle: `${t.unidades.length} ${t.unidades.length === 1 ? 'unidad' : 'unidades'}`,
        resumen: t.resumen,
        bajar: { regionId: region.regionAsistenciaId, tramoId: t.tramoId },
        filtroEventos: { tramoId: t.tramoId },
      }));
    } else {
      filas = datos.regiones.map((r) => ({
        clave: `${r.regionAsistenciaId}`,
        nombre: r.region,
        detalle: `Región ${REGION_MACRO[r.regionMacro] ?? ''} · ${r.tramos.length} ${r.tramos.length === 1 ? 'tramo' : 'tramos'}`,
        resumen: r.resumen,
        bajar: { regionId: r.regionAsistenciaId, tramoId: null },
        filtroEventos: null,
      }));
    }
    return filas.sort((a, b) => b.resumen.totalEventos - a.resumen.totalEventos);
  });
  protected readonly maxFila = computed(() => Math.max(1, ...this.filas().map((f) => f.resumen.totalEventos)));

  /** Unidades con eventos dentro del nivel elegido (una ficha reasignada suma sus denominaciones). */
  private readonly unidadesConEventos = computed(() => {
    const datos = this.datos();
    const { regionId, tramoId } = this.seleccion();
    const porUnidad = new Map<number, { unidadId: number; ficha: string; denominaciones: Set<string>; total: number }>();
    for (const r of datos?.regiones ?? []) {
      if (regionId !== null && r.regionAsistenciaId !== regionId) continue;
      for (const t of r.tramos) {
        if (tramoId !== null && t.tramoId !== tramoId) continue;
        for (const u of t.unidades) {
          const actual = porUnidad.get(u.unidadId) ?? { unidadId: u.unidadId, ficha: u.ficha, denominaciones: new Set(), total: 0 };
          actual.denominaciones.add(u.denominacion);
          actual.total += u.resumen.totalEventos;
          porUnidad.set(u.unidadId, actual);
        }
      }
    }
    return [...porUnidad.values()].filter((u) => u.total > 0).sort((a, b) => b.total - a.total);
  });
  protected readonly topUnidades = computed(() => {
    const unidades = this.unidadesConEventos().slice(0, TOP_UNIDADES);
    const max = unidades[0]?.total ?? 1;
    return unidades.map((u) => ({ ...u, denominacion: [...u.denominaciones].join(', '), ancho: (u.total / max) * 100 }));
  });

  constructor() {
    effect(() => {
      if (this.actual.hasValue()) this.actualizado.set(new Date());
    });

    const intervalo = setInterval(() => {
      if (this.autoRefresco() && document.visibilityState === 'visible') this.refrescar();
    }, REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  protected elegirPeriodo(periodo: Periodo): void {
    this.hoy.set(hoyRD());
    this.periodo.set(periodo);
  }

  protected refrescar(): void {
    const hoy = hoyRD();
    if (hoy !== this.hoy()) {
      // Cambió el día: los recursos se vuelven a pedir solos al cambiar los parámetros
      this.hoy.set(hoy);
      return;
    }
    this.actual.reload();
    this.anterior.reload();
    this.tendencia.reload();
  }

  /** Query params para abrir el módulo Eventos con el período (y el filtro) de la fila. */
  protected filtroEventos(extra: Record<string, number> | null = null): Record<string, string | number> {
    return { ...this.rango(), ...(extra ?? {}) };
  }

  protected horaActualizacion(): string {
    return this.actualizado()?.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' }) ?? '';
  }
}

/** Resumen del nivel elegido (todo, una región o un tramo) dentro de una respuesta. */
function resumenDe(datos: Estadisticas | undefined, { regionId, tramoId }: Seleccion): Resumen | undefined {
  if (!datos) return undefined;
  if (regionId === null) return datos.resumen;
  const region = datos.regiones.find((r) => r.regionAsistenciaId === regionId);
  if (!region) return VACIO;
  if (tramoId === null) return region.resumen;
  return region.tramos.find((t) => t.tramoId === tramoId)?.resumen ?? VACIO;
}

const VACIO: Resumen = { totalEventos: 0, porCategoria: [], porTipo: [] };

/** Variación porcentual respecto del período anterior; null si no hay con qué comparar. */
function variacion(valor: number, previo: number | null): number | null {
  if (previo === null || previo === 0) return null;
  return Math.round(((valor - previo) / previo) * 100);
}
