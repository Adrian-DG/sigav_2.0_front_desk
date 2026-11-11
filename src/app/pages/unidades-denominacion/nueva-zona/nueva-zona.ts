import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { Selector, type OpcionSelector } from '../../../shared/components/selector/selector';
import { erroresPorClave, REGIONES } from '../unidades-denominacion.model';

/** Mismos límites que Domain Zona.NombreMaxLength / Tramo.NombreMaxLength. */
const NOMBRE_MAX = 100;

/** Minúsculas, sin acentos ni espacios de más: para detectar tramos repetidos. */
function clave(texto: string): string {
  return texto.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Alta de una zona con sus tramos (POST /zonas): nombre, región y una lista de tramos que se
 * guardan junto con la zona. Los tramos quedan disponibles para elegirlos al crear denominaciones.
 */
@Component({
  selector: 'app-nueva-zona',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, Selector],
  templateUrl: './nueva-zona.html',
})
export class NuevaZona {
  private readonly http = inject(HttpClient);

  readonly abierto = input(false);
  readonly cerrar = output();
  /** Texto del aviso para el listado. */
  readonly creada = output<string>();

  protected readonly nombreMax = NOMBRE_MAX;
  protected readonly opcionesRegion: OpcionSelector[] = Object.entries(REGIONES).map(([id, nombre]) => ({
    id: Number(id),
    nombre,
  }));

  protected readonly nombre = signal('');
  protected readonly region = signal<number | null>(null);
  /** Un campo por tramo; siempre hay al menos uno (puede quedar vacío: se ignora). */
  protected readonly tramos = signal<string[]>(['']);

  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Record<string, string>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  /** Tramos con nombre (los campos vacíos no se envían). */
  private readonly tramosEscritos = computed(() => this.tramos().map((t) => t.trim()).filter(Boolean));

  protected readonly errores = computed(() => {
    const e: Record<string, string> = {};
    const nombre = this.nombre().trim();
    if (!nombre) e['nombre'] = 'El nombre es requerido.';
    else if (nombre.length > NOMBRE_MAX) e['nombre'] = `Máximo ${NOMBRE_MAX} caracteres.`;
    if (this.region() === null) e['region'] = 'Seleccione la región.';

    const vistos = new Set<string>();
    this.tramos().forEach((t, i) => {
      const k = clave(t);
      if (!k) return;
      if (t.trim().length > NOMBRE_MAX) e[`tramos[${i}]`] = `Máximo ${NOMBRE_MAX} caracteres.`;
      else if (vistos.has(k)) e[`tramos[${i}]`] = 'Este tramo está repetido.';
      vistos.add(k);
    });
    return e;
  });

  constructor() {
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => {
        this.nombre.set('');
        this.region.set(null);
        this.tramos.set(['']);
        this.intentado.set(false);
        this.limpiarErroresApi();
      });
    });
  }

  protected error(campo: string): string | null {
    return this.erroresApi()[campo.toLowerCase()] ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected limpiarErroresApi(): void {
    this.erroresApi.set({});
    this.errorGeneral.set(null);
  }

  protected cambiarTramo(i: number, valor: string): void {
    this.tramos.update((t) => t.map((x, j) => (j === i ? valor : x)));
    this.limpiarErroresApi();
  }

  protected agregarTramo(): void {
    this.tramos.update((t) => [...t, '']);
    // Enfoca el campo recién agregado
    setTimeout(() => document.getElementById(`tramo-${this.tramos().length - 1}`)?.focus());
  }

  protected quitarTramo(i: number): void {
    this.tramos.update((t) => (t.length === 1 ? [''] : t.filter((_, j) => j !== i)));
    this.limpiarErroresApi();
  }

  /** Enter en un tramo agrega otro en lugar de enviar el formulario. */
  protected enterEnTramo(evento: Event, i: number): void {
    evento.preventDefault();
    if (i === this.tramos().length - 1 && this.tramos()[i].trim()) this.agregarTramo();
    else document.getElementById(`tramo-${i + 1}`)?.focus();
  }

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const nombre = this.nombre().trim();
    const tramos = this.tramosEscritos();
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.http.post(`${environment.apiUrl}/zonas`, { nombre, region: this.region(), tramos }).subscribe({
      next: () => {
        this.guardando.set(false);
        const detalle = tramos.length
          ? ` con ${tramos.length} ${tramos.length === 1 ? 'tramo' : 'tramos'}, ya disponibles para las denominaciones`
          : '';
        this.creada.emit(`Se creó la zona ${nombre}${detalle}.`);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const errores = erroresPorClave(error instanceof ApiError ? error.errors : null);
        // Los índices de la API son los de la lista enviada (sin vacíos): se traducen a los campos
        const indices = this.tramos().flatMap((t, i) => (t.trim() ? [i] : []));
        const traducidos = Object.fromEntries(
          Object.entries(errores).map(([k, m]) => {
            const coincide = /^tramos\[(\d+)\]$/.exec(k);
            return [coincide ? `tramos[${indices[Number(coincide[1])] ?? coincide[1]}]` : k, m];
          }),
        );
        this.erroresApi.set(traducidos);
        const otros = Object.entries(traducidos)
          .filter(([c]) => c !== 'nombre' && c !== 'region' && !c.startsWith('tramos['))
          .map(([, m]) => m);
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(traducidos).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }
}
