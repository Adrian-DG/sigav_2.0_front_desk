import { Component, Directive, contentChild, input } from '@angular/core';

import { Icon, type IconName } from '../icon/icon';

/** Marca el contenido que va a la derecha del encabezado (botones de acción). */
@Directive({ selector: '[moduloAcciones]' })
export class ModuloAcciones {}

/** Marca la barra de filtros, entre el encabezado y el cuerpo. */
@Directive({ selector: '[moduloFiltros]' })
export class ModuloFiltros {}

/**
 * Marco común de las páginas de módulo: encabezado (título, descripción y acciones), barra de
 * filtros opcional y el cuerpo, que recibe por content projection el listado o lo que el módulo
 * necesite. Las secciones de acciones y filtros solo se dibujan si se proyecta algo en ellas.
 *
 * ```html
 * <app-module-page titulo="Agentes" descripcion="..." icono="agentes">
 *   <app-button moduloAcciones>Nuevo</app-button>
 *   <div moduloFiltros>...</div>
 *   <tabla-de-agentes />
 * </app-module-page>
 * ```
 */
@Component({
  selector: 'app-module-page',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 items-start gap-4">
          @if (icono(); as icono) {
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"
            >
              <app-icon [name]="icono" class="h-6 w-6" />
            </span>
          }
          <div class="min-w-0">
            <h1 class="text-2xl font-extrabold tracking-tight text-neutral-900">{{ titulo() }}</h1>
            @if (descripcion()) {
              <p class="mt-1 text-sm font-medium text-neutral-500">{{ descripcion() }}</p>
            }
          </div>
        </div>

        @if (acciones()) {
          <div class="flex flex-wrap items-center gap-2">
            <ng-content select="[moduloAcciones]" />
          </div>
        }
      </header>

      @if (filtros()) {
        <section
          aria-label="Filtros"
          class="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm"
        >
          <ng-content select="[moduloFiltros]" />
        </section>
      }

      <section class="min-w-0">
        <ng-content />
      </section>
    </div>
  `,
})
export class ModulePage {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly icono = input<IconName>();

  protected readonly acciones = contentChild(ModuloAcciones);
  protected readonly filtros = contentChild(ModuloFiltros);
}
