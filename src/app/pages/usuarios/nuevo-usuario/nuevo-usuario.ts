import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { INSTITUCIONES } from '../../../core/models/catalogos';
import { ApiError } from '../../../core/models/api-error';
import { mensajeDeError } from '../../../core/utils/formato';
import { Button } from '../../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../../shared/components/dialogo/dialogo';
import type { CatalogosUsuario, PermisoInfo } from '../usuarios.model';

/** Institución cuyos rangos tienen nombre propio (Domain InstitucionEnum.ARD, ver Rango.NombreArmada). */
const ARMADA = 3;

type Campo =
  | 'userName'
  | 'password'
  | 'confirmacion'
  | 'identificacion'
  | 'nombre'
  | 'apellido'
  | 'sexo'
  | 'institucion'
  | 'rangoId'
  | 'departamentoId';

type Formulario = Record<Campo, string> & { permisos: ReadonlySet<string> };

const VACIO: Formulario = {
  userName: '',
  password: '',
  confirmacion: '',
  identificacion: '',
  nombre: '',
  apellido: '',
  sexo: '',
  institucion: '',
  rangoId: '',
  departamentoId: '',
  permisos: new Set(),
};

/** Mismas reglas que CrearUsuarioCommandValidator (Backend/Application/Features/Usuarios/CrearUsuario.cs). */
const REGLAS_PASSWORD: { texto: string; cumple: (p: string) => boolean }[] = [
  { texto: 'Al menos 8 caracteres', cumple: (p) => p.length >= 8 },
  { texto: 'Una letra mayúscula', cumple: (p) => /[A-Z]/.test(p) },
  { texto: 'Una letra minúscula', cumple: (p) => /[a-z]/.test(p) },
  { texto: 'Un número', cumple: (p) => /[0-9]/.test(p) },
  { texto: 'Un símbolo (. - _ @ #…)', cumple: (p) => /[^a-zA-Z0-9]/.test(p) },
];

/**
 * Alta de un usuario del front desk (POST /usuarios) en un diálogo: datos personales, acceso y
 * permisos iniciales. Valida en el navegador lo evidente (requeridos, contraseña, confirmación) y
 * muestra junto a cada campo lo que rechace la API.
 */
@Component({
  selector: 'app-nuevo-usuario',
  standalone: true,
  imports: [Dialogo, DialogoAcciones, Button, NgTemplateOutlet],
  templateUrl: './nuevo-usuario.html',
})
export class NuevoUsuario {
  private readonly http = inject(HttpClient);

  readonly abierto = input(false);
  readonly permisos = input<PermisoInfo[]>([]);
  readonly cerrar = output();
  /** Nombre del usuario creado, para el aviso del listado. */
  readonly creado = output<string>();

  protected readonly instituciones = Object.entries(INSTITUCIONES)
    .filter(([valor]) => valor !== '0')
    .map(([valor, label]) => ({ valor, label }));
  protected readonly reglasPassword = REGLAS_PASSWORD;

  // Los catálogos se piden la primera vez que se abre el formulario
  private readonly usado = signal(false);
  protected readonly catalogos = httpResource<CatalogosUsuario>(() =>
    this.usado() ? `${environment.apiUrl}/usuarios/catalogos` : undefined,
  );

  protected readonly form = signal<Formulario>(VACIO);
  protected readonly intentado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly erroresApi = signal<Partial<Record<Campo, string>>>({});
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly esArmada = computed(() => this.form().institucion === String(ARMADA));

  protected readonly errores = computed(() => {
    const f = this.form();
    const e: Partial<Record<Campo, string>> = {};
    const requerido = (campo: Campo, texto: string) => {
      if (!f[campo].trim()) e[campo] = texto;
    };
    requerido('userName', 'El usuario es requerido.');
    requerido('identificacion', 'La cédula es requerida.');
    requerido('nombre', 'El nombre es requerido.');
    requerido('apellido', 'El apellido es requerido.');
    requerido('sexo', 'Seleccione el sexo.');
    requerido('institucion', 'Seleccione la institución.');
    requerido('rangoId', 'Seleccione el rango.');
    requerido('departamentoId', 'Seleccione el departamento.');
    if (!REGLAS_PASSWORD.every((r) => r.cumple(f.password))) e.password = 'La contraseña no cumple los requisitos.';
    if (f.confirmacion !== f.password) e.confirmacion = 'Las contraseñas no coinciden.';
    return e;
  });

  constructor() {
    // Cada vez que se abre, formulario limpio
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => {
        this.usado.set(true);
        this.form.set({ ...VACIO, permisos: new Set() });
        this.intentado.set(false);
        this.erroresApi.set({});
        this.errorGeneral.set(null);
      });
    });
  }

  /** Error a mostrar en un campo: el de la API, o el local una vez que se intentó guardar. */
  protected error(campo: Campo): string | null {
    return this.erroresApi()[campo] ?? (this.intentado() ? (this.errores()[campo] ?? null) : null);
  }

  protected valor(campo: Campo): string {
    return this.form()[campo];
  }

  protected cambiar(campo: Campo, valor: string): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
    if (this.erroresApi()[campo]) this.erroresApi.update(({ [campo]: _, ...resto }) => resto);
  }

  protected alternarPermiso(permiso: string, marcado: boolean): void {
    this.form.update((f) => {
      const permisos = new Set(f.permisos);
      if (marcado) permisos.add(permiso);
      else permisos.delete(permiso);
      return { ...f, permisos };
    });
  }

  protected rangoLabel(rango: { nombre: string; nombreArmada: string }): string {
    return this.esArmada() && rango.nombreArmada ? rango.nombreArmada : rango.nombre;
  }

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    this.intentado.set(true);
    if (Object.keys(this.errores()).length > 0 || this.guardando()) return;

    const f = this.form();
    const body = {
      userName: f.userName.trim(),
      password: f.password,
      identificacion: f.identificacion.trim(),
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim(),
      sexo: Number(f.sexo),
      institucion: Number(f.institucion),
      rangoId: Number(f.rangoId),
      departamentoId: Number(f.departamentoId),
      permisos: [...f.permisos],
    };

    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.http.post<{ id: number }>(`${environment.apiUrl}/usuarios`, body).subscribe({
      next: () => {
        this.guardando.set(false);
        this.creado.emit(`${body.nombre} ${body.apellido}`);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        const { porCampo, otros } = aCampos(error instanceof ApiError ? error.errors : null);
        this.erroresApi.set(porCampo);
        // 409 (usuario o cédula repetidos) y errores que no son de un campo del formulario, arriba del pie
        if (otros.length > 0) this.errorGeneral.set(otros.join(' '));
        else if (Object.keys(porCampo).length === 0) this.errorGeneral.set(mensajeDeError(error));
      },
    });
  }
}

const CAMPOS: readonly Campo[] = [
  'userName',
  'password',
  'confirmacion',
  'identificacion',
  'nombre',
  'apellido',
  'sexo',
  'institucion',
  'rangoId',
  'departamentoId',
];

/** { "UserName": ["..."] } de ValidationException → { userName: "..." } (primer mensaje por campo). */
function aCampos(errors: Record<string, string[]> | null): { porCampo: Partial<Record<Campo, string>>; otros: string[] } {
  const porCampo: Partial<Record<Campo, string>> = {};
  const otros: string[] = [];
  for (const [clave, mensajes] of Object.entries(errors ?? {})) {
    const campo = CAMPOS.find((c) => c.toLowerCase() === clave.toLowerCase());
    if (campo) porCampo[campo] = mensajes[0];
    else otros.push(...mensajes);
  }
  return { porCampo, otros };
}
