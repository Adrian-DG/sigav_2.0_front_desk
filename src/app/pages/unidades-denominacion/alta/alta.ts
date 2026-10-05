import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Selector, type OpcionSelector } from '../../../shared/components/selector/selector';
import {
  erroresPorClave,
  FICHA_VALIDA,
  MENSAJE_FICHA,
  MENSAJE_PLACA,
  type OpcionesAsignacion,
  PLACA_VALIDA,
} from '../unidades-denominacion.model';

export type TipoAlta = 'unidad' | 'denominacion';

type Campo = 'ficha' | 'placa' | 'nombre' | 'tramoId' | 'nivelDenominacionId';

/**
 * Alta sin asignación: una unidad (POST /unidades, queda sin denominación y No disponible) o una
 * denominación (POST /denominaciones, queda libre). Para crear y asignar en un paso está
 * app-asignar-denominacion.
 */
@Component({
  selector: 'app-alta',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Selector],
  templateUrl: './alta.html',
})
export class Alta {
  private readonly http = inject(HttpClient);

  /** null: cerrado. */
  readonly tipo = input<TipoAlta | null>(null);
  readonly opciones = input<OpcionesAsignacion | undefined>();
  readonly cerrar = output();
  /** Texto del aviso para el listado. */
  readonly creado = output<string>();

  protected readonly ficha = signal('');
  protected readonly placa = signal('');
  protected readonly nombre = signal('');
  protected readonly tramoId = signal<number | null>(null);
  protected readonly nivelId = signal('');

  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Record<string, string>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly opcionesTramo = computed<OpcionSelector[]>(() => this.opciones()?.tramos ?? []);

  protected readonly errores = computed(() => {
    const e: Partial<Record<Campo, string>> = {};
    if (this.tipo() === 'unidad') {
      const ficha = this.ficha().trim().toUpperCase();
      if (!ficha) e.ficha = 'La ficha es requerida.';
      else if (!FICHA_VALIDA.test(ficha)) e.ficha = MENSAJE_FICHA;
      const placa = this.placa().trim().toUpperCase();
      if (placa && !PLACA_VALIDA.test(placa)) e.placa = MENSAJE_PLACA;
    } else {
      if (!this.nombre().trim()) e.nombre = 'El nombre es requerido.';
      if (this.tramoId() === null) e.tramoId = 'Seleccione el tramo.';
      if (!this.nivelId()) e.nivelDenominacionId = 'Seleccione el nivel.';
    }
    return e;
  });

  constructor() {
    effect(() => {
      if (!this.tipo()) return;
      untracked(() => {
        this.ficha.set('');
        this.placa.set('');
        this.nombre.set('');
        this.tramoId.set(null);
        this.nivelId.set('');
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
      });
    });
  }

  protected error(campo: Campo): string | null {
    return this.erroresApi()[campo.toLowerCase()] ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected limpiarErroresApi(): void {
    this.erroresApi.set({});
    this.errorGeneral.set(null);
  }

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const esUnidad = this.tipo() === 'unidad';
    const ficha = this.ficha().trim().toUpperCase();
    const nombre = this.nombre().trim();
    const peticion = esUnidad
      ? this.http.post(`${environment.apiUrl}/unidades`, { ficha, placa: this.placa().trim().toUpperCase() || null })
      : this.http.post(`${environment.apiUrl}/denominaciones`, {
          nombre,
          tramoId: this.tramoId(),
          nivelDenominacionId: Number(this.nivelId()),
        });

    this.guardando.set(true);
    this.errorGeneral.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.creado.emit(
          esUnidad
            ? `Se creó la unidad ${ficha}. Queda sin denominación y No disponible hasta que se le asigne una.`
            : `Se creó la denominación ${nombre}. Queda libre para asignarla a una unidad.`,
        );
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const errores = erroresPorClave(error instanceof ApiError ? error.errors : null);
        this.erroresApi.set(errores);
        const otros = Object.entries(errores).filter(([c]) => !CAMPOS.includes(c)).map(([, m]) => m);
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(errores).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }
}

const CAMPOS = ['ficha', 'placa', 'nombre', 'tramoid', 'niveldenominacionid'];
