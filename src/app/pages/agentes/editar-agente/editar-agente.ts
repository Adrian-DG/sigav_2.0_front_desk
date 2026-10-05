import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/models/api-error';
import { INSTITUCIONES } from '../../../core/models/catalogos';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import { AREAS_OPERATIVAS, type Agente } from '../agentes.model';

/** Institución cuyos rangos tienen nombre propio (Domain InstitucionEnum.ARD, Rango.NombreArmada). */
const ARMADA = 3;
const ESPECIALIDAD_MAX = 100;

type Rango = { id: number; nombre: string; nombreArmada: string };

type Campo =
  | 'identificacion'
  | 'nombre'
  | 'apellido'
  | 'sexo'
  | 'institucion'
  | 'rangoId'
  | 'areaOperativa'
  | 'especialidad';

type Formulario = Record<Campo, string> & { accesoTotal: boolean };

/**
 * Edición de un agente (PUT /agentes/{id}): datos personales, institución, rango (ascensos),
 * área operativa y especialidad. La autorización se cambia aparte, desde el listado.
 */
@Component({
  selector: 'app-editar-agente',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button],
  templateUrl: './editar-agente.html',
})
export class EditarAgente {
  private readonly http = inject(HttpClient);

  /** null: cerrado. */
  readonly agente = input<Agente | null>(null);
  readonly cerrar = output();
  /** Texto del aviso para el listado. */
  readonly guardado = output<string>();

  protected readonly instituciones = Object.entries(INSTITUCIONES)
    .filter(([valor]) => valor !== '0')
    .map(([valor, label]) => ({ valor, label }));
  protected readonly areas = Object.entries(AREAS_OPERATIVAS).map(([valor, label]) => ({ valor, label }));
  protected readonly especialidadMax = ESPECIALIDAD_MAX;

  // Los rangos se piden la primera vez que se abre
  private readonly usado = signal(false);
  protected readonly rangos = httpResource<Rango[]>(() => (this.usado() ? `${environment.apiUrl}/catalogos/rangos` : undefined));

  protected readonly form = signal<Formulario>(vacio());
  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Partial<Record<Campo, string>>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly esArmada = computed(() => this.form().institucion === String(ARMADA));

  /** Si cambió el rango respecto del que tenía (para destacar el ascenso en el aviso). */
  private readonly rangoOriginal = signal<number | null>(null);

  protected readonly errores = computed(() => {
    const f = this.form();
    const e: Partial<Record<Campo, string>> = {};
    const cedula = f.identificacion.replace(/[^0-9a-zA-Z]/g, '');
    if (!cedula) e.identificacion = 'La cédula es requerida.';
    else if (cedula.length < 8 || cedula.length > 11) e.identificacion = 'La cédula debe tener entre 8 y 11 caracteres (sin guiones).';
    if (!f.nombre.trim()) e.nombre = 'El nombre es requerido.';
    if (!f.apellido.trim()) e.apellido = 'El apellido es requerido.';
    if (!f.institucion) e.institucion = 'Seleccione la institución.';
    if (!f.rangoId) e.rangoId = 'Seleccione el rango.';
    if (!f.areaOperativa) e.areaOperativa = 'Seleccione el área operativa.';
    if (f.especialidad.length > ESPECIALIDAD_MAX) e.especialidad = `Máximo ${ESPECIALIDAD_MAX} caracteres.`;
    return e;
  });

  constructor() {
    // Cada vez que se abre: los datos actuales del agente
    effect(() => {
      const a = this.agente();
      if (!a) return;
      untracked(() => {
        this.usado.set(true);
        this.form.set({
          identificacion: a.identificacion,
          nombre: a.nombre,
          apellido: a.apellido,
          sexo: String(a.sexo),
          institucion: String(a.institucion),
          rangoId: String(a.rangoId),
          areaOperativa: String(a.areaOperativa),
          especialidad: a.especialidad ?? '',
          accesoTotal: a.accesoTotal,
        });
        this.rangoOriginal.set(a.rangoId);
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
      });
    });
  }

  protected error(campo: Campo): string | null {
    return this.erroresApi()[campo] ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected valor(campo: Campo): string {
    return this.form()[campo];
  }

  protected cambiar(campo: Campo | 'accesoTotal', valor: string | boolean): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
    this.erroresApi.update((e) => ({ ...e, [campo]: undefined }));
    this.errorGeneral.set(null);
  }

  protected rangoLabel(r: Rango): string {
    return this.esArmada() && r.nombreArmada ? r.nombreArmada : r.nombre;
  }

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    const agente = this.agente();
    this.intentado.set(true);
    if (!agente || Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const f = this.form();
    const body = {
      identificacion: f.identificacion.trim(),
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim(),
      sexo: Number(f.sexo || 0),
      institucion: Number(f.institucion),
      rangoId: Number(f.rangoId),
      areaOperativa: Number(f.areaOperativa),
      accesoTotal: f.accesoTotal,
      especialidad: f.especialidad.trim() || null,
    };

    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.http.put(`${environment.apiUrl}/agentes/${agente.id}`, body).subscribe({
      next: () => {
        this.guardando.set(false);
        const nombre = `${body.nombre} ${body.apellido}`;
        const rango = this.rangos.hasValue() ? this.rangos.value().find((r) => r.id === body.rangoId) : undefined;
        this.guardado.emit(
          body.rangoId !== this.rangoOriginal() && rango
            ? `Se actualizó a ${nombre}: nuevo rango ${this.rangoLabel(rango)}.`
            : `Se actualizaron los datos de ${nombre}.`,
        );
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const porCampo: Partial<Record<Campo, string>> = {};
        const otros: string[] = [];
        for (const [clave, mensajes] of Object.entries(error instanceof ApiError ? (error.errors ?? {}) : {})) {
          const campo = CAMPOS.find((c) => c.toLowerCase() === clave.toLowerCase());
          if (campo) porCampo[campo] = mensajes[0];
          else otros.push(...mensajes);
        }
        this.erroresApi.set(porCampo);
        // 409 (cédula de otro agente), 400 del dominio (agente inactivo)…
        if (otros.length) this.errorGeneral.set(otros.join(' '));
        else if (!Object.keys(porCampo).length) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }
}

const CAMPOS: readonly Campo[] = [
  'identificacion',
  'nombre',
  'apellido',
  'sexo',
  'institucion',
  'rangoId',
  'areaOperativa',
  'especialidad',
];

function vacio(): Formulario {
  return {
    identificacion: '',
    nombre: '',
    apellido: '',
    sexo: '',
    institucion: '',
    rangoId: '',
    areaOperativa: '',
    especialidad: '',
    accesoTotal: false,
  };
}
