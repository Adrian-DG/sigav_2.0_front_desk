import { Component, computed, input, model } from '@angular/core';

import type { PermisoInfo } from '../usuarios.model';

export type ModuloPermisos = {
  nombre: string;
  permisos: PermisoInfo[];
};

/** Agrupa el catálogo por módulo, en el orden en que lo envía la API. */
export function agruparPorModulo(catalogo: readonly PermisoInfo[]): ModuloPermisos[] {
  const modulos = new Map<string, PermisoInfo[]>();
  for (const p of catalogo) {
    const lista = modulos.get(p.modulo) ?? [];
    lista.push(p);
    modulos.set(p.modulo, lista);
  }
  return [...modulos].map(([nombre, permisos]) => ({ nombre, permisos }));
}

/**
 * Selección de permisos agrupados por módulo (catálogo de GET /usuarios/permisos). Cada módulo
 * tiene un interruptor para marcar o quitar todos sus permisos. Respeta las dependencias de la API
 * (PermisoInfo.requiere): marcar un permiso marca el que requiere y quitar uno quita los que
 * dependen de él. Los permisos de `bloqueados` no se pueden quitar (ni lo que ellos requieren).
 */
@Component({
  selector: 'app-selector-permisos',
  standalone: true,
  templateUrl: './selector-permisos.html',
})
export class SelectorPermisos {
  readonly catalogo = input.required<readonly PermisoInfo[]>();
  readonly seleccion = model.required<ReadonlySet<string>>();
  readonly bloqueados = input<ReadonlySet<string>>(new Set());
  readonly deshabilitado = input(false);
  /** Dos columnas de módulos (diálogos amplios). */
  readonly columnas = input(false);

  protected readonly modulos = computed(() => agruparPorModulo(this.catalogo()));
  private readonly porNombre = computed(() => new Map(this.catalogo().map((p) => [p.nombre, p])));

  protected readonly totalMarcados = computed(() => this.catalogo().filter((p) => this.seleccion().has(p.nombre)).length);

  /** Permisos que no se pueden quitar: los bloqueados y, en cadena, lo que ellos requieren. */
  private readonly fijos = computed(() => {
    const fijos = new Set<string>();
    const pendientes = [...this.bloqueados()];
    while (pendientes.length) {
      const nombre = pendientes.pop()!;
      if (fijos.has(nombre)) continue;
      fijos.add(nombre);
      const requiere = this.porNombre().get(nombre)?.requiere;
      if (requiere) pendientes.push(requiere);
    }
    return fijos;
  });

  protected marcado(permiso: string): boolean {
    return this.seleccion().has(permiso);
  }

  protected fijo(permiso: string): boolean {
    return this.fijos().has(permiso) && this.seleccion().has(permiso);
  }

  protected titulo(permiso: string | null | undefined): string {
    return (permiso && this.porNombre().get(permiso)?.titulo) || permiso || '';
  }

  /** Permisos marcados que dependen de este (se quitarían con él). */
  protected dependientesMarcados(permiso: string): string[] {
    return this.catalogo()
      .filter((p) => p.requiere === permiso && this.seleccion().has(p.nombre))
      .map((p) => p.titulo);
  }

  protected marcadosEn(modulo: ModuloPermisos): number {
    return modulo.permisos.filter((p) => this.seleccion().has(p.nombre)).length;
  }

  protected alternar(permiso: string, marcar: boolean): void {
    const nueva = new Set(this.seleccion());
    if (marcar) this.agregar(nueva, permiso);
    else this.quitar(nueva, permiso);
    this.seleccion.set(nueva);
  }

  protected alternarModulo(modulo: ModuloPermisos, marcar: boolean): void {
    const nueva = new Set(this.seleccion());
    for (const p of modulo.permisos) {
      if (marcar) this.agregar(nueva, p.nombre);
      else this.quitar(nueva, p.nombre);
    }
    this.seleccion.set(nueva);
  }

  protected marcarTodos(marcar: boolean): void {
    const nueva = new Set(this.seleccion());
    for (const p of this.catalogo()) {
      if (marcar) this.agregar(nueva, p.nombre);
      else this.quitar(nueva, p.nombre);
    }
    this.seleccion.set(nueva);
  }

  /** Agrega el permiso y, en cadena, lo que requiere. */
  private agregar(conjunto: Set<string>, permiso: string): void {
    for (let actual: string | null | undefined = permiso; actual && !conjunto.has(actual); actual = this.porNombre().get(actual)?.requiere) {
      conjunto.add(actual);
    }
  }

  /** Quita el permiso y, en cadena, los que dependen de él (salvo los fijos, que lo mantienen). */
  private quitar(conjunto: Set<string>, permiso: string): void {
    if (this.fijos().has(permiso) || !conjunto.has(permiso)) return;
    conjunto.delete(permiso);
    for (const p of this.catalogo()) {
      if (p.requiere === permiso) this.quitar(conjunto, p.nombre);
    }
  }
}
