import { HttpClient, httpResource } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { huella } from '../../../core/utils/huella';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Selector, type OpcionSelector } from '../../../shared/components/selector/selector';
import { CATEGORIA_EVENTO, CategoriaEvento, type FiltrosEventos } from '../eventos.model';
import { erroresPorClave } from '../../unidades-denominacion/unidades-denominacion.model';
import {
  CANALES_ASIGNACION,
  COMENTARIO_MAX,
  DIRECCION_MAX,
  describirAgente,
  ocupacionAgente,
  distanciaKm,
  type AsignarEventoRequest,
  type AsignarEventoResult,
  type CatalogoItem,
  type TipoEventoItem,
  type UnidadDisponibilidad,
} from '../asignacion.model';
import { unidadesConSesion } from '../unidades-con-sesion';

/** Lo que emite al asignar: el resultado y a quién quedó, para el aviso de la página. */
export type EventoAsignado = AsignarEventoResult & { ficha: string; agente: string | null };

type Formulario = {
  canal: number;
  tipoEventoIds: number[];
  latitud: number | null;
  longitud: number | null;
  provinciaId: number | null;
  municipioId: number | null;
  tramoId: number | null;
  direccion: string;
  comentario: string;
  unidadId: number | null;
  agenteId: number | null;
};

/** Centro aproximado de la República Dominicana. */
const CENTRO_RD: Leaflet.LatLngTuple = [18.75, -70.2];

/**
 * Crea un evento del call center y lo asigna a una unidad disponible (POST /asignaciones/eventos).
 * La ubicación se marca con un clic en el mapa; las unidades se ordenan por cercanía a ese punto.
 * Solo se ofrecen unidades con al menos un agente libre (el de la sesión o su componente); el
 * agente que lo atenderá se elige entre los libres. La unidad recibe la notificación al momento si
 * tiene la app conectada, y lo ve como pendiente en su lista de eventos asignados. Las unidades se
 * piden al abrir y se refrescan mientras el diálogo sigue abierto.
 */
@Component({
  selector: 'app-nuevo-evento',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Selector],
  templateUrl: './nuevo-evento.html',
})
export class NuevoEvento {
  private readonly http = inject(HttpClient);

  readonly abierto = input(false);
  readonly cerrar = output();

  private readonly dialogo = viewChild.required(Dialogo);
  /** Contenido del formulario al abrirlo: si cambia, cerrar pide confirmación. */
  private readonly huellaInicial = signal('');
  protected readonly sucio = computed(() => huella(this.form()) !== this.huellaInicial());
  readonly asignado = output<EventoAsignado>();

  private readonly conSesion = unidadesConSesion(this.abierto);
  protected readonly unidades = this.conSesion.lista;
  protected readonly cargandoUnidades = this.conSesion.cargando;
  protected readonly errorUnidades = this.conSesion.error;
  protected readonly recargarUnidades = this.conSesion.recargar;

  protected readonly canales = CANALES_ASIGNACION;
  protected readonly direccionMax = DIRECCION_MAX;
  protected readonly comentarioMax = COMENTARIO_MAX;
  protected readonly CATEGORIA_EVENTO = CATEGORIA_EVENTO;
  protected readonly describirAgente = describirAgente;
  protected readonly ocupacionAgente = ocupacionAgente;

  protected readonly form = signal<Formulario>(this.vacio());
  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Record<string, string>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  // ------------------------------------------------ Catálogos (se piden al abrir por primera vez)

  private readonly abiertoAlgunaVez = signal(false);
  private readonly tiposEvento = httpResource<TipoEventoItem[]>(() =>
    this.abiertoAlgunaVez() ? `${environment.apiUrl}/catalogos/tipos-evento` : undefined,
  );
  private readonly provincias = httpResource<CatalogoItem[]>(() =>
    this.abiertoAlgunaVez() ? `${environment.apiUrl}/catalogos/provincias` : undefined,
  );
  private readonly municipios = httpResource<CatalogoItem[]>(() => {
    const provinciaId = this.form().provinciaId;
    return provinciaId ? `${environment.apiUrl}/catalogos/provincias/${provinciaId}/municipios` : undefined;
  });
  private readonly filtros = httpResource<FiltrosEventos>(() =>
    this.abiertoAlgunaVez() ? `${environment.apiUrl}/eventos/filtros` : undefined,
  );

  protected readonly errorCatalogos = computed(() =>
    mensajeDeError(this.tiposEvento.error() ?? this.provincias.error() ?? this.municipios.error() ?? this.filtros.error()),
  );

  /** Tipos agrupados por categoría (Asistencia, Accidente). */
  protected readonly gruposTipos = computed(() => {
    const tipos = this.tiposEvento.hasValue() ? this.tiposEvento.value() : [];
    return [CategoriaEvento.Asistencia, CategoriaEvento.Accidente]
      .map((categoria) => ({ categoria, tipos: tipos.filter((t) => t.categoria === categoria) }))
      .filter((g) => g.tipos.length > 0);
  });
  protected readonly cargandoTipos = computed(() => this.tiposEvento.isLoading());

  protected readonly opcionesProvincia = computed<OpcionSelector[]>(() => (this.provincias.hasValue() ? this.provincias.value() : []));
  protected readonly opcionesMunicipio = computed<OpcionSelector[]>(() => (this.municipios.hasValue() ? this.municipios.value() : []));
  protected readonly opcionesTramo = computed<OpcionSelector[]>(() =>
    this.filtros.hasValue() ? this.filtros.value().tramos.map((t) => ({ id: t.id, nombre: t.nombre, detalle: t.detalle })) : [],
  );

  // ------------------------------------------------ Unidad y agente

  /** Unidades con algún agente libre, las más cercanas al punto del evento primero. */
  private readonly disponibles = computed(() => {
    const { latitud, longitud } = this.form();
    return this.unidades()
      .filter((u) => u.disponible)
      .map((u) => ({
        unidad: u,
        km: latitud !== null && longitud !== null ? distanciaKm(latitud, longitud, u.latitud, u.longitud) : null,
      }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.unidad.ficha.localeCompare(b.unidad.ficha));
  });

  protected readonly opcionesUnidad = computed<OpcionSelector[]>(() =>
    this.disponibles().map(({ unidad: u, km }) => ({
      id: u.unidadId,
      nombre: u.ficha,
      detalle: [
        u.denominacion ?? 'Sin denominación',
        km !== null ? `a ${km < 10 ? km.toFixed(1) : Math.round(km)} km` : null,
        u.agentes.length > 1 ? `${u.agentes.filter((a) => a.disponible).length} de ${u.agentes.length} agentes libres` : null,
        u.conectadaNotificaciones ? null : 'sin notificaciones',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  protected readonly unidad = computed(() => this.unidades().find((u) => u.unidadId === this.form().unidadId) ?? null);

  protected readonly errores = computed(() => {
    const f = this.form();
    const e: Record<string, string> = {};
    if (f.tipoEventoIds.length === 0) e['tipos'] = 'Seleccione al menos un tipo de evento.';
    if (f.latitud === null || f.longitud === null) e['ubicacion'] = 'Marque en el mapa dónde ocurre el evento.';
    if (f.municipioId === null) e['municipio'] = 'Seleccione el municipio.';
    if (f.direccion.length > DIRECCION_MAX) e['direccion'] = `Máximo ${DIRECCION_MAX} caracteres.`;
    if (f.comentario.length > COMENTARIO_MAX) e['comentario'] = `Máximo ${COMENTARIO_MAX} caracteres.`;
    const unidad = this.unidad();
    if (f.unidadId === null) e['unidad'] = 'Seleccione la unidad que atenderá el evento.';
    else if (!unidad?.disponible) e['unidad'] = 'La unidad ya no está disponible: elija otra.';
    else if (f.agenteId === null) e['agente'] = 'Seleccione el agente que atenderá el evento.';
    else if (!unidad.agentes.some((a) => a.agenteId === f.agenteId && a.disponible)) e['agente'] = 'El agente ya no está libre: elija otro.';
    return e;
  });

  // ------------------------------------------------ Mapa

  private readonly contenedorMapa = viewChild.required<ElementRef<HTMLElement>>('mapa');
  protected readonly errorMapa = signal<string | null>(null);
  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private marcador: Leaflet.Marker | null = null;
  private marcadoresUnidades: Leaflet.LayerGroup | null = null;

  constructor() {
    // Cada vez que se abre: formulario limpio
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => {
        this.abiertoAlgunaVez.set(true);
        this.form.set(this.vacio());
        this.huellaInicial.set(huella(this.form()));
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
        // El <dialog> recién se muestra: Leaflet necesita medir el contenedor ya visible
        setTimeout(() => void this.prepararMapa());
      });
    });

    // Unidades disponibles en el mapa (se actualizan con cada refresco)
    effect(() => {
      const disponibles = this.disponibles();
      const seleccionada = this.form().unidadId;
      untracked(() => this.dibujarUnidades(disponibles.map((d) => d.unidad), seleccionada));
    });

    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
  }

  /** Error de un campo: el de la API (por cualquiera de sus claves) o el local tras intentar guardar. */
  protected error(campo: string, ...clavesApi: string[]): string | null {
    const api = this.erroresApi();
    const deApi = clavesApi.map((c) => api[c]).find(Boolean);
    return deApi ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
    this.erroresApi.set({});
    this.errorGeneral.set(null);
  }

  protected cambiarProvincia(provinciaId: number | null): void {
    this.form.update((f) => ({ ...f, provinciaId, municipioId: null }));
  }

  protected cambiarUnidad(unidadId: number | null): void {
    const unidad = this.unidades().find((u) => u.unidadId === unidadId);
    this.form.update((f) => ({ ...f, unidadId, agenteId: this.primerLibre(unidad) }));
    this.erroresApi.set({});
    this.errorGeneral.set(null);
  }

  protected alternarTipo(id: number, marcado: boolean): void {
    const ids = this.form().tipoEventoIds.filter((t) => t !== id);
    this.cambiar('tipoEventoIds', marcado ? [...ids, id] : ids);
  }

  /** Coordenada escrita a mano (p. ej. la que dicta quien reporta). */
  protected cambiarCoordenada(campo: 'latitud' | 'longitud', texto: string): void {
    const valor = texto.trim() === '' ? null : Number(texto);
    this.cambiar(campo, valor !== null && Number.isFinite(valor) ? valor : null);
    const { latitud, longitud } = this.form();
    if (latitud !== null && longitud !== null) this.ubicarMarcador(latitud, longitud, true);
  }

  protected cancelar(): void {
    this.dialogo().solicitarCierre();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const f = this.form();
    const body: AsignarEventoRequest = {
      latitud: Number(f.latitud!.toFixed(6)),
      longitud: Number(f.longitud!.toFixed(6)),
      municipioId: f.municipioId!,
      tipoEventoIds: f.tipoEventoIds,
      unidadId: f.unidadId!,
      agenteId: f.agenteId,
      tramoId: f.tramoId,
      direccion: f.direccion.trim() || null,
      comentario: f.comentario.trim() || null,
      canalReporte: f.canal,
    };

    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.http.post<AsignarEventoResult>(`${environment.apiUrl}/asignaciones/eventos`, body).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        const unidad = this.unidades().find((u) => u.unidadId === resultado.unidadId);
        const agente = unidad?.agentes.find((a) => a.agenteId === resultado.agenteId);
        this.asignado.emit({ ...resultado, ficha: unidad?.ficha ?? '', agente: agente ? describirAgente(agente) : null });
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const errores = erroresPorClave(error instanceof ApiError ? error.errors : null);
        this.erroresApi.set(errores);
        // 409 (la unidad o el agente dejaron de estar libres) y lo que no es de un campo van arriba del pie
        const otros = Object.entries(errores).filter(([clave]) => !CLAVES_CAMPOS.includes(clave)).map(([, m]) => m);
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(errores).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }

  private primerLibre(unidad: UnidadDisponibilidad | undefined | null): number | null {
    return unidad?.agentes.find((a) => a.disponible)?.agenteId ?? null;
  }

  private async prepararMapa(): Promise<void> {
    try {
      if (!this.mapa) {
        const modulo = await import('leaflet');
        const L = ((modulo as unknown as { default?: typeof Leaflet }).default ?? modulo) as typeof Leaflet;
        this.L = L;
        this.mapa = L.map(this.contenedorMapa().nativeElement, { zoomSnap: 0.5, minZoom: 7 }).setView(CENTRO_RD, 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.mapa);
        this.marcadoresUnidades = L.layerGroup().addTo(this.mapa);
        this.mapa.on('click', (e: Leaflet.LeafletMouseEvent) => {
          this.cambiar('latitud', e.latlng.lat);
          this.cambiar('longitud', e.latlng.lng);
          this.ubicarMarcador(e.latlng.lat, e.latlng.lng, false);
        });
      }
      this.mapa.invalidateSize();
      this.marcador?.remove();
      this.marcador = null;
      this.mapa.setView(CENTRO_RD, 8);
      this.dibujarUnidades(this.disponibles().map((d) => d.unidad), this.form().unidadId);
    } catch {
      this.errorMapa.set('No se pudo cargar el mapa: escriba la latitud y la longitud.');
    }
  }

  private ubicarMarcador(latitud: number, longitud: number, centrar: boolean): void {
    const L = this.L;
    if (!L || !this.mapa) return;
    if (this.marcador) this.marcador.setLatLng([latitud, longitud]);
    else
      this.marcador = L.marker([latitud, longitud], {
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: '<div class="h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-danger-600 shadow-md"></div>',
        }),
        zIndexOffset: 10_000,
        title: 'Ubicación del evento',
      }).addTo(this.mapa);
    if (centrar) this.mapa.setView([latitud, longitud], Math.max(this.mapa.getZoom(), 13));
  }

  /** Las unidades disponibles como puntos (la seleccionada resaltada); clic para elegirla. */
  private dibujarUnidades(unidades: UnidadDisponibilidad[], seleccionada: number | null): void {
    const L = this.L;
    const capa = this.marcadoresUnidades;
    if (!L || !capa) return;
    capa.clearLayers();
    for (const u of unidades) {
      const elegida = u.unidadId === seleccionada;
      const html = document.createElement('div');
      html.className = 'relative';
      const punto = document.createElement('div');
      punto.className = `absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${elegida ? 'h-5 w-5 bg-primary-600' : 'h-3.5 w-3.5 bg-secondary-600'}`;
      const etiqueta = document.createElement('span');
      etiqueta.className = `absolute top-2.5 -translate-x-1/2 rounded bg-white/95 px-1 text-[10px] font-extrabold whitespace-nowrap shadow ${elegida ? 'text-primary-700' : 'text-secondary-700'}`;
      etiqueta.textContent = u.ficha;
      html.append(punto, etiqueta);
      L.marker([u.latitud, u.longitud], { icon: L.divIcon({ html, className: '', iconSize: [0, 0] }), title: `Unidad ${u.ficha}` })
        .on('click', () => this.cambiarUnidad(u.unidadId))
        .addTo(capa);
    }
  }

  private vacio(): Formulario {
    return {
      canal: CANALES_ASIGNACION[0].id,
      tipoEventoIds: [],
      latitud: null,
      longitud: null,
      provinciaId: null,
      municipioId: null,
      tramoId: null,
      direccion: '',
      comentario: '',
      unidadId: null,
      agenteId: null,
    };
  }
}

/** Claves de error de la API que se muestran junto a un campo (ver error() en la plantilla). */
const CLAVES_CAMPOS = [
  'tipoeventoids',
  'latitud',
  'longitud',
  'municipioid',
  'tramoid',
  'direccion',
  'comentario',
  'unidadid',
  'agenteid',
  'canalreporte',
];
