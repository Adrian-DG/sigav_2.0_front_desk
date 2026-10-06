import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { Icon, type IconName } from '../icon/icon';

export type OpcionMenu = {
  label: string;
  icono?: IconName;
  tono?: 'normal' | 'peligro';
  accion: () => void;
};

type Estado = { titulo?: string; opciones: OpcionMenu[] };

const MARGEN = 8;

/**
 * Menú de acciones flotante. Una instancia por página: `abrir(evento, opciones)` lo muestra junto
 * al cursor (clic derecho, evento `contextmenu`) o bajo el botón que lo disparó (clic / teclado).
 * Se cierra con Esc, Tab, clic fuera, scroll o al elegir una opción; con el teclado se recorre
 * con ↑ ↓ Inicio Fin y el foco vuelve al disparador al cerrar con Esc.
 */
@Component({
  selector: 'app-menu-contextual',
  standalone: true,
  imports: [Icon],
  template: `
    @if (estado(); as e) {
      <div
        #menu
        role="menu"
        [attr.aria-label]="e.titulo ?? 'Opciones'"
        class="fixed z-50 min-w-56 overflow-hidden rounded-xl bg-white py-1.5 shadow-xl ring-1 ring-neutral-200"
        [style.left.px]="posicion().x"
        [style.top.px]="posicion().y"
        [style.opacity]="medido() ? 1 : 0"
        [style.pointer-events]="medido() ? 'auto' : 'none'"
        (keydown)="navegar($event)"
      >
        @if (e.titulo) {
          <p class="truncate px-3.5 pt-1 pb-1.5 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
            {{ e.titulo }}
          </p>
        }
        @for (opcion of e.opciones; track opcion.label) {
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            class="flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm font-semibold transition-colors focus:outline-none"
            [class]="
              opcion.tono === 'peligro'
                ? 'text-danger-700 hover:bg-danger-50 focus:bg-danger-50'
                : 'text-neutral-700 hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:text-primary-700'
            "
            (click)="elegir(opcion)"
          >
            @if (opcion.icono) {
              <app-icon [name]="opcion.icono" class="h-4 w-4" />
            }
            {{ opcion.label }}
          </button>
        }
      </div>
    }
  `,
})
export class MenuContextual implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly estado = signal<Estado | null>(null);
  protected readonly posicion = signal({ x: 0, y: 0 });
  /**
   * Transparente (pero renderizado) hasta medirlo y ajustarlo al viewport: sin parpadeo fuera de
   * pantalla. Con opacity y no visibility, para poder darle el foco a la primera opción enseguida.
   */
  protected readonly medido = signal(false);

  private disparador: HTMLElement | null = null;

  abrir(evento: MouseEvent, opciones: OpcionMenu[], titulo?: string): void {
    evento.preventDefault();
    evento.stopPropagation();
    const disparador = evento.currentTarget as HTMLElement;

    // Segundo clic en el mismo botón: lo cierra (como un toggle)
    if (this.estado() && this.disparador === disparador && evento.type !== 'contextmenu') {
      this.cerrar(true);
      return;
    }

    const alCursor = evento.type === 'contextmenu' && (evento.clientX !== 0 || evento.clientY !== 0);
    const rect = disparador.getBoundingClientRect();
    const ancla = alCursor
      ? { x: evento.clientX, y: evento.clientY, alinearDerecha: false }
      : { x: rect.right, y: rect.bottom + 4, alinearDerecha: true };

    this.disparador = disparador;
    this.medido.set(false);
    this.posicion.set({ x: ancla.x, y: ancla.y });
    this.estado.set({ titulo, opciones });
    this.escuchar(true);

    afterNextRender(
      () => {
        const menu = this.menu()?.nativeElement;
        if (!menu) return;
        const { width, height } = menu.getBoundingClientRect();
        let x = ancla.alinearDerecha ? ancla.x - width : ancla.x;
        let y = ancla.y;
        // Sin espacio abajo: se abre hacia arriba (sobre el botón o el cursor)
        if (y + height > innerHeight - MARGEN) y = (alCursor ? ancla.y : rect.top - 4) - height;
        x = Math.min(Math.max(MARGEN, x), innerWidth - width - MARGEN);
        y = Math.min(Math.max(MARGEN, y), innerHeight - height - MARGEN);
        this.posicion.set({ x, y });
        this.medido.set(true);
        this.items()[0]?.focus();
      },
      { injector: this.injector },
    );
  }

  cerrar(devolverFoco = false): void {
    if (!this.estado()) return;
    this.estado.set(null);
    this.escuchar(false);
    if (devolverFoco) this.disparador?.focus();
    this.disparador = null;
  }

  ngOnDestroy(): void {
    this.escuchar(false);
  }

  protected elegir(opcion: OpcionMenu): void {
    this.cerrar(true);
    opcion.accion();
  }

  protected navegar(evento: KeyboardEvent): void {
    const items = this.items();
    const actual = items.indexOf(document.activeElement as HTMLButtonElement);
    const destino: Record<string, number> = {
      ArrowDown: (actual + 1) % items.length,
      ArrowUp: (actual - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (evento.key in destino) {
      evento.preventDefault();
      items[destino[evento.key]]?.focus();
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cerrar(true);
    } else if (evento.key === 'Tab') {
      this.cerrar(false);
    }
  }

  private items(): HTMLButtonElement[] {
    return [...(this.menu()?.nativeElement.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])];
  }

  private readonly alPresionar = (evento: PointerEvent) => {
    const objetivo = evento.target as Node;
    if (this.menu()?.nativeElement.contains(objetivo) || this.disparador?.contains(objetivo)) return;
    this.cerrar();
  };
  private readonly alDesplazar = (evento: Event) => {
    if (this.menu()?.nativeElement.contains(evento.target as Node)) return;
    this.cerrar();
  };
  private readonly alRedimensionar = () => this.cerrar();

  private escuchar(activo: boolean): void {
    const metodo = activo ? 'addEventListener' : 'removeEventListener';
    document[metodo]('pointerdown', this.alPresionar as EventListener, true);
    // capture: también el scroll de contenedores internos (p. ej. la tabla con overflow-x)
    document[metodo]('scroll', this.alDesplazar, true);
    window[metodo]('resize', this.alRedimensionar);
  }
}
