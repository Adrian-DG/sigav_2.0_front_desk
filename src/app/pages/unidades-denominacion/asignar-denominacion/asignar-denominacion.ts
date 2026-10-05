import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Selector, type OpcionSelector } from '../../../shared/components/selector/selector';
import {
  type AsignacionResultado,
  erroresPorClave,
  FICHA_VALIDA,
  MENSAJE_FICHA,
  MENSAJE_PLACA,
  type OpcionesAsignacion,
  PLACA_VALIDA,
} from '../unidades-denominacion.model';

type Modo = 'existente' | 'nueva';

/** Lo que se preselecciona al abrir (desde la fila de una unidad o de una denominación). */
export type InicioAsignacion = { unidadId?: number; denominacionId?: number };

type Formulario = {
  modoUnidad: Modo;
  unidadId: number | null;
  ficha: string;
  placa: string;
  modoDenominacion: Modo;
  denominacionId: number | null;
  nombre: string;
  tramoId: number | null;
  nivelId: string;
  motivo: string;
};

const MOTIVO_MAX = 250;

/**
 * Asigna una denominación a una unidad (POST /unidades/asignar-denominacion). Cada lado puede ser
 * existente o crearse en el momento. Antes de confirmar avisa qué pasará: si la denominación la
 * usa otra ficha, esa ficha quedará sin denominación y No disponible; si la unidad tenía otra
 * denominación, esa queda libre.
 */
@Component({
  selector: 'app-asignar-denominacion',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Selector, NgTemplateOutlet],
  templateUrl: './asignar-denominacion.html',
})
export class AsignarDenominacion {
  private readonly http = inject(HttpClient);

  /** null: cerrado. */
  readonly inicio = input<InicioAsignacion | null>(null);
  readonly opciones = input<OpcionesAsignacion | undefined>();
  readonly cerrar = output();
  readonly asignado = output<AsignacionResultado>();

  protected readonly motivoMax = MOTIVO_MAX;
  protected readonly form = signal<Formulario>(this.vacio());
  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Record<string, string>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly opcionesUnidad = computed<OpcionSelector[]>(() =>
    (this.opciones()?.unidades ?? []).map((u) => ({
      id: u.id,
      nombre: u.ficha,
      detalle: [u.denominacion ?? 'Sin denominación', u.placa, u.estaDisponible ? null : 'No disponible'].filter(Boolean).join(' · '),
    })),
  );
  protected readonly opcionesDenominacion = computed<OpcionSelector[]>(() =>
    (this.opciones()?.denominaciones ?? []).map((d) => ({
      id: d.id,
      nombre: d.nombre,
      detalle: `${d.nivelDenominacion} · ${d.tramo} · ${d.unidadFicha ? 'En uso por ' + d.unidadFicha : 'Libre'}`,
    })),
  );
  protected readonly opcionesTramo = computed<OpcionSelector[]>(() => this.opciones()?.tramos ?? []);

  private readonly unidad = computed(() => {
    const f = this.form();
    return f.modoUnidad === 'existente' ? this.opciones()?.unidades.find((u) => u.id === f.unidadId) : undefined;
  });
  private readonly denominacion = computed(() => {
    const f = this.form();
    return f.modoDenominacion === 'existente' ? this.opciones()?.denominaciones.find((d) => d.id === f.denominacionId) : undefined;
  });

  /** Qué va a pasar al confirmar (lo mismo que hará la API). */
  protected readonly efectos = computed(() => {
    const unidad = this.unidad();
    const denominacion = this.denominacion();
    const yaLaTiene = !!unidad && !!denominacion && unidad.denominacionId === denominacion.id;
    return {
      yaLaTiene,
      /** Ficha que perderá la denominación. */
      desplazada: denominacion?.unidadFicha && denominacion.unidadId !== unidad?.id ? denominacion.unidadFicha : null,
      /** Denominación que deja la unidad (queda libre). */
      anterior: unidad?.denominacion && !yaLaTiene ? unidad.denominacion : null,
    };
  });

  protected readonly errores = computed(() => {
    const f = this.form();
    const e: Record<string, string> = {};
    if (f.modoUnidad === 'existente') {
      if (f.unidadId === null) e['unidad'] = 'Seleccione la unidad.';
    } else {
      const ficha = f.ficha.trim().toUpperCase();
      if (!ficha) e['ficha'] = 'La ficha es requerida.';
      else if (!FICHA_VALIDA.test(ficha)) e['ficha'] = MENSAJE_FICHA;
      const placa = f.placa.trim().toUpperCase();
      if (placa && !PLACA_VALIDA.test(placa)) e['placa'] = MENSAJE_PLACA;
    }
    if (f.modoDenominacion === 'existente') {
      if (f.denominacionId === null) e['denominacion'] = 'Seleccione la denominación.';
    } else {
      if (!f.nombre.trim()) e['nombre'] = 'El nombre es requerido.';
      if (f.tramoId === null) e['tramo'] = 'Seleccione el tramo.';
      if (!f.nivelId) e['nivel'] = 'Seleccione el nivel.';
    }
    if (f.motivo.length > MOTIVO_MAX) e['motivo'] = `Máximo ${MOTIVO_MAX} caracteres.`;
    return e;
  });

  constructor() {
    // Cada vez que se abre: formulario limpio con lo preseleccionado
    effect(() => {
      const inicio = this.inicio();
      if (!inicio) return;
      untracked(() => {
        this.form.set({
          ...this.vacio(),
          unidadId: inicio.unidadId ?? null,
          denominacionId: inicio.denominacionId ?? null,
        });
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
      });
    });
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

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const f = this.form();
    const body = {
      unidadId: f.modoUnidad === 'existente' ? f.unidadId : null,
      nuevaUnidad: f.modoUnidad === 'nueva' ? { ficha: f.ficha.trim().toUpperCase(), placa: f.placa.trim().toUpperCase() || null } : null,
      denominacionId: f.modoDenominacion === 'existente' ? f.denominacionId : null,
      nuevaDenominacion:
        f.modoDenominacion === 'nueva'
          ? { nombre: f.nombre.trim(), tramoId: f.tramoId, nivelDenominacionId: Number(f.nivelId) }
          : null,
      motivo: f.motivo.trim() || null,
    };

    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.http.post<AsignacionResultado>(`${environment.apiUrl}/unidades/asignar-denominacion`, body).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        this.asignado.emit(resultado);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const errores = erroresPorClave(error instanceof ApiError ? error.errors : null);
        this.erroresApi.set(errores);
        // Lo que no es de un campo del formulario (409 ficha o nombre repetidos, unidad desactivada…) va arriba del pie
        const otros = Object.entries(errores).filter(([clave]) => !CLAVES_CAMPOS.includes(clave)).map(([, m]) => m);
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(errores).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }

  private vacio(): Formulario {
    return {
      modoUnidad: 'existente',
      unidadId: null,
      ficha: '',
      placa: '',
      modoDenominacion: 'existente',
      denominacionId: null,
      nombre: '',
      tramoId: null,
      nivelId: '',
      motivo: '',
    };
  }
}

/** Claves de error de la API que se muestran junto a un campo (ver error() en la plantilla). */
const CLAVES_CAMPOS = [
  'unidad',
  'unidadid',
  'nuevaunidad.ficha',
  'nuevaunidad.placa',
  'denominacion',
  'denominacionid',
  'nuevadenominacion.nombre',
  'nuevadenominacion.tramoid',
  'nuevadenominacion.niveldenominacionid',
  'motivo',
];
