import { Component, computed, input, model, signal } from '@angular/core';

import { Icon } from '../icon/icon';

export type OpcionSelector = { id: number; nombre: string; detalle?: string | null };

/** Opciones que se dibujan como máximo; con más, el usuario debe seguir escribiendo. */
const MAXIMO_VISIBLE = 50;

/** Minúsculas y sin acentos: "Gómez" coincide con "gomez". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Select con búsqueda (combobox) para listas largas: al enfocarlo se escribe para filtrar por
 * nombre o detalle (todas las palabras, sin importar acentos) y se elige con clic, Enter o las
 * flechas. `valor` es el id elegido o null (todos).
 */
@Component({
  selector: 'app-selector',
  standalone: true,
  imports: [Icon],
  template: `
    <div class="relative">
      <input
        type="text"
        role="combobox"
        autocomplete="off"
        class="control w-full pr-9 data-elegido:placeholder:text-neutral-900"
        [attr.data-elegido]="seleccionada() ? '' : null"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="idLista"
        [attr.aria-activedescendant]="abierto() && filtradas().length ? idLista + '-' + activo() : null"
        [placeholder]="seleccionada()?.nombre ?? placeholder()"
        [value]="abierto() ? texto() : (seleccionada()?.nombre ?? '')"
        [disabled]="deshabilitado()"
        (focus)="abrir()"
        (click)="abierto() || abrir()"
        (blur)="abierto.set(false)"
        (input)="escribir($any($event.target).value)"
        (keydown)="tecla($event)"
      />
      @if (valor() !== null && !deshabilitado()) {
        <button
          type="button"
          [attr.aria-label]="'Quitar ' + (seleccionada()?.nombre ?? 'selección')"
          class="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          (mousedown)="$event.preventDefault()"
          (click)="elegir(null)"
        >
          <app-icon name="limpiar" class="h-4 w-4" />
        </button>
      }

      @if (abierto()) {
        <ul
          [id]="idLista"
          role="listbox"
          class="absolute z-20 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
          (mousedown)="$event.preventDefault()"
          (click)="$event.preventDefault()"
        >
          <!-- mousedown: el input no pierde el foco. click: dentro de un <label> (app-filtro) el
               clic se reenviaría al input y volvería a abrir la lista. -->
          @for (opcion of filtradas(); track opcion.id; let i = $index) {
            <li
              [id]="idLista + '-' + i"
              role="option"
              class="cursor-pointer px-3 py-2 text-sm"
              [class.bg-primary-50]="i === activo()"
              [attr.aria-selected]="opcion.id === valor()"
              (mouseenter)="activo.set(i)"
              (click)="elegir(opcion.id)"
            >
              <span class="block font-semibold text-neutral-900" [class.text-primary-700]="opcion.id === valor()">
                {{ opcion.nombre }}
              </span>
              @if (opcion.detalle) {
                <span class="block text-xs text-neutral-500">{{ opcion.detalle }}</span>
              }
            </li>
          } @empty {
            <li class="px-3 py-2 text-sm text-neutral-500">
              {{ opciones().length ? 'Ninguna opción coincide.' : 'No hay opciones.' }}
            </li>
          }
          @if (restantes() > 0) {
            <li class="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500">
              {{ restantes() }} más… escriba para acotar.
            </li>
          }
        </ul>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class Selector {
  private static siguienteId = 0;
  protected readonly idLista = `selector-lista-${Selector.siguienteId++}`;

  readonly valor = model<number | null>(null);
  readonly opciones = input<readonly OpcionSelector[]>([]);
  readonly placeholder = input('Todos');
  readonly deshabilitado = input(false);

  protected readonly abierto = signal(false);
  protected readonly texto = signal('');
  protected readonly activo = signal(0);

  protected readonly seleccionada = computed(() => this.opciones().find((o) => o.id === this.valor()) ?? null);

  private readonly coincidencias = computed(() => {
    const palabras = normalizar(this.texto()).split(/\s+/).filter(Boolean);
    if (!palabras.length) return this.opciones();
    return this.opciones().filter((o) => {
      const texto = normalizar(`${o.nombre} ${o.detalle ?? ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  });
  protected readonly filtradas = computed(() => this.coincidencias().slice(0, MAXIMO_VISIBLE));
  protected readonly restantes = computed(() => this.coincidencias().length - this.filtradas().length);

  protected abrir(): void {
    this.texto.set('');
    this.activo.set(0);
    this.abierto.set(true);
  }

  protected escribir(texto: string): void {
    this.texto.set(texto);
    this.activo.set(0);
    this.abierto.set(true);
  }

  protected elegir(id: number | null): void {
    this.valor.set(id);
    this.abierto.set(false);
  }

  protected tecla(evento: KeyboardEvent): void {
    const total = this.filtradas().length;
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        if (!this.abierto()) this.abrir();
        else if (total) this.activo.set((this.activo() + 1) % total);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (total) this.activo.set((this.activo() - 1 + total) % total);
        break;
      case 'Enter':
        if (this.abierto() && total) {
          evento.preventDefault();
          this.elegir(this.filtradas()[this.activo()].id);
        }
        break;
      case 'Escape':
        if (this.abierto()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.abierto.set(false);
        }
        break;
    }
  }
}
