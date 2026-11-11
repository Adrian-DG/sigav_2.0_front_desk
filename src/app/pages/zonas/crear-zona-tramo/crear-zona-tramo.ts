import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { NOMBRE_MAX, REGIONES, type Creacion, type Zona } from '../zonas.model';

type Campo = 'nombre' | 'region' | 'zonaId';

/**
 * Alta de una zona (POST /zonas: nombre y región) o de un tramo (POST /tramos: nombre y zona). Un
 * nombre que ya existe lo rechaza la API (409); el tramo queda listo para asignarlo a denominaciones.
 */
@Component({
  selector: 'app-crear-zona-tramo',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button],
  templateUrl: './crear-zona-tramo.html',
})
export class CrearZonaTramo {
  private readonly http = inject(HttpClient);

  /** null: cerrado. */
  readonly creacion = input<Creacion | null>(null);
  /** Zonas activas donde se puede crear el tramo. */
  readonly zonas = input<Zona[]>([]);
  readonly cerrar = output();
  /** Texto del aviso para el listado. */
  readonly creado = output<string>();

  private readonly dialogo = viewChild.required(Dialogo);

  protected readonly regiones = REGIONES;
  protected readonly nombreMax = NOMBRE_MAX;

  protected readonly esZona = computed(() => this.creacion()?.tipo === 'zona');
  protected readonly nombre = signal('');
  protected readonly region = signal('');
  protected readonly zonaId = signal('');
  /** Contenido al abrir: si cambia, cerrar pide confirmación. */
  private readonly inicial = signal('');
  protected readonly sucio = computed(() => this.huella() !== this.inicial());

  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Partial<Record<Campo, string>>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  /** Zonas ordenadas por región para el selector, con la región en la etiqueta. */
  protected readonly opcionesZona = computed(() =>
    [...this.zonas()]
      .sort((a, b) => a.region - b.region || a.nombre.localeCompare(b.nombre))
      .map((z) => ({ id: z.id, label: `${z.nombre} · Región ${REGIONES.find((r) => r.valor === z.region)?.label ?? ''}` })),
  );

  protected readonly errores = computed(() => {
    const e: Partial<Record<Campo, string>> = {};
    const nombre = this.nombre().trim();
    if (!nombre) e.nombre = 'El nombre es requerido.';
    else if (nombre.length > NOMBRE_MAX) e.nombre = `Máximo ${NOMBRE_MAX} caracteres.`;
    if (this.esZona()) {
      if (!this.region()) e.region = 'Seleccione la región de la zona.';
    } else if (!this.zonaId()) e.zonaId = 'Seleccione la zona del tramo.';
    return e;
  });

  constructor() {
    // Cada vez que se abre: formulario vacío (con la zona elegida si se abrió desde ella)
    effect(() => {
      const c = this.creacion();
      if (!c) return;
      untracked(() => {
        this.nombre.set('');
        this.region.set('');
        this.zonaId.set(c.tipo === 'tramo' && c.zonaId ? String(c.zonaId) : '');
        this.inicial.set(this.huella());
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
      });
    });
  }

  private huella(): string {
    return JSON.stringify([this.nombre(), this.region(), this.zonaId()]);
  }

  protected error(campo: Campo): string | null {
    return this.erroresApi()[campo] ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected cambiar(campo: Campo, valor: string): void {
    ({ nombre: this.nombre, region: this.region, zonaId: this.zonaId })[campo].set(valor);
    this.erroresApi.update((e) => ({ ...e, [campo]: undefined }));
    this.errorGeneral.set(null);
  }

  protected cancelar(): void {
    this.dialogo().solicitarCierre();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (!this.creacion() || Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const nombre = this.nombre().trim();
    const esZona = this.esZona();
    const peticion = esZona
      ? this.http.post(`${environment.apiUrl}/zonas`, { nombre, region: Number(this.region()) })
      : this.http.post(`${environment.apiUrl}/tramos`, { nombre, zonaId: Number(this.zonaId()) });

    this.guardando.set(true);
    this.errorGeneral.set(null);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        const zona = this.zonas().find((z) => z.id === Number(this.zonaId()));
        this.creado.emit(
          esZona
            ? `Se creó la zona ${nombre}. Ya puede agregarle tramos.`
            : `Se creó el tramo ${nombre}${zona ? ` en ${zona.nombre}` : ''}: ya se puede asignar a las denominaciones.`,
        );
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const porCampo: Partial<Record<Campo, string>> = {};
        const otros: string[] = [];
        for (const [clave, mensajes] of Object.entries(error instanceof ApiError ? (error.errors ?? {}) : {})) {
          const campo = (['nombre', 'region', 'zonaId'] as const).find((c) => c.toLowerCase() === clave.toLowerCase());
          if (campo) porCampo[campo] = mensajes[0];
          else otros.push(...mensajes);
        }
        this.erroresApi.set(porCampo);
        // 409 (nombre repetido), 404 (la zona se desactivó)…
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(porCampo).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }
}
