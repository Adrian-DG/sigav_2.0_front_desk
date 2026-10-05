import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { INSTITUCIONES } from '../../core/models/catalogos';
import type { PagedResult } from '../../core/models/paged-result';
import { Permisos } from '../../core/permissions/permisos';
import { AuthService } from '../../core/services/auth.service';
import { mensajeDeError } from '../../core/utils/formato';
import { Badge } from '../../shared/components/badge/badge';
import { Busqueda } from '../../shared/components/busqueda/busqueda';
import { Button } from '../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../shared/components/dialogo/dialogo';
import { EstadoLista } from '../../shared/components/estado-lista/estado-lista';
import { Filtro } from '../../shared/components/filtro/filtro';
import { Icon } from '../../shared/components/icon/icon';
import { ModulePage, ModuloAcciones, ModuloFiltros } from '../../shared/components/module-page/module-page';
import { Paginador } from '../../shared/components/paginador/paginador';
import { NuevoUsuario } from './nuevo-usuario/nuevo-usuario';
import type { PermisoInfo, Usuario } from './usuarios.model';

const TAMANO_PAGINA = 20;

/**
 * Usuarios del front desk y sus permisos (GET /usuarios). "Nuevo usuario" abre el alta
 * (app-nuevo-usuario, POST /usuarios). "Permisos" abre un diálogo con el
 * catálogo (GET /usuarios/permisos) y guarda con PUT /usuarios/{id}/permisos. Los permisos viajan
 * en el token, así que el usuario los recibe al volver a iniciar sesión.
 */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    ModulePage,
    ModuloAcciones,
    ModuloFiltros,
    Filtro,
    Busqueda,
    EstadoLista,
    Paginador,
    Badge,
    Button,
    Icon,
    Dialogo,
    DialogoAcciones,
    NuevoUsuario,
  ],
  templateUrl: './usuarios.html',
})
export class Usuarios {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  protected readonly INSTITUCION = INSTITUCIONES;
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly permisoGestionar = Permisos.Usuarios;

  protected readonly busqueda = signal('');
  protected readonly pagina = linkedSignal({ source: this.busqueda, computation: () => 1 });

  protected readonly usuarios = httpResource<PagedResult<Usuario>>(() => {
    const params: Record<string, string | number> = { page: this.pagina(), size: TAMANO_PAGINA };
    if (this.busqueda()) params['searchTerm'] = this.busqueda();
    return { url: `${environment.apiUrl}/usuarios`, params };
  });

  protected readonly resultado = linkedSignal<PagedResult<Usuario> | undefined, PagedResult<Usuario> | undefined>({
    source: () => (this.usuarios.hasValue() ? this.usuarios.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });
  protected readonly error = computed(() => mensajeDeError(this.usuarios.error()));

  protected readonly catalogo = httpResource<PermisoInfo[]>(() => `${environment.apiUrl}/usuarios/permisos`);
  private readonly modulos = computed(
    () => new Map((this.catalogo.hasValue() ? this.catalogo.value() : []).map((p) => [p.nombre, p.modulo])),
  );

  protected readonly miId = computed(() => this.auth.sesion()?.userId ?? null);
  /** Aviso tras guardar (se muestra sobre el listado). */
  protected readonly aviso = signal<string | null>(null);

  // Alta de usuario
  protected readonly nuevoAbierto = signal(false);

  protected abrirNuevo(): void {
    this.aviso.set(null);
    this.nuevoAbierto.set(true);
  }

  protected usuarioCreado(nombre: string): void {
    this.nuevoAbierto.set(false);
    this.aviso.set(`Se creó el usuario ${nombre}. Ya puede iniciar sesión con su usuario y contraseña.`);
    this.usuarios.reload();
  }

  // Diálogo de permisos
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly seleccion = signal<ReadonlySet<string>>(new Set());
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  protected readonly hayCambios = computed(() => {
    const usuario = this.editando();
    if (!usuario) return false;
    const actuales = new Set(usuario.permisos.filter((p) => this.modulos().has(p)));
    const nuevos = this.seleccion();
    return actuales.size !== nuevos.size || [...nuevos].some((p) => !actuales.has(p));
  });

  protected modulo(permiso: string): string {
    return this.modulos().get(permiso) ?? permiso;
  }

  /** No se puede quitar uno mismo el permiso de gestionar usuarios (la API también lo impide). */
  protected bloqueado(permiso: string): boolean {
    return permiso === this.permisoGestionar && this.editando()?.id === this.miId();
  }

  protected abrir(usuario: Usuario): void {
    this.editando.set(usuario);
    this.seleccion.set(new Set(usuario.permisos));
    this.errorGuardar.set(null);
    this.aviso.set(null);
  }

  protected cerrar(): void {
    if (!this.guardando()) this.editando.set(null);
  }

  protected alternar(permiso: string, marcado: boolean): void {
    const nueva = new Set(this.seleccion());
    if (marcado) nueva.add(permiso);
    else nueva.delete(permiso);
    this.seleccion.set(nueva);
  }

  protected guardar(): void {
    const usuario = this.editando();
    if (!usuario || this.guardando()) return;

    // Solo se envían los del catálogo: la API rechaza nombres desconocidos
    const permisos = [...this.seleccion()].filter((p) => this.modulos().has(p));
    this.guardando.set(true);
    this.errorGuardar.set(null);

    this.http.put(`${environment.apiUrl}/usuarios/${usuario.id}/permisos`, { permisos }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(null);
        this.aviso.set(
          usuario.id === this.miId()
            ? 'Se actualizaron sus permisos. Cierre sesión y vuelva a entrar para que se apliquen.'
            : `Se actualizaron los permisos de ${usuario.nombreCompleto || usuario.userName}. Se aplicarán la próxima vez que inicie sesión.`,
        );
        this.usuarios.reload();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorGuardar.set(mensajeDeError(error));
      },
    });
  }
}
