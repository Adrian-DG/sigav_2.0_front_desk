import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AvisosService, type Aviso } from '../../../core/services/avisos.service';
import { Icon } from '../icon/icon';

/**
 * Pila de avisos flotantes abajo a la derecha (ver AvisosService). Las regiones aria-live están
 * siempre en el DOM para que el lector de pantalla anuncie cada aviso nuevo: los de éxito con
 * cortesía (status) y los errores de inmediato (alert).
 */
@Component({
  selector: 'app-avisos',
  standalone: true,
  imports: [Icon, NgTemplateOutlet],
  template: `
    <div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
      <div role="status" aria-live="polite" class="flex flex-col gap-2">
        @for (a of exitos(); track a.id) {
          <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: a }" />
        }
      </div>
      <div role="alert" aria-live="assertive" class="flex flex-col gap-2">
        @for (a of errores(); track a.id) {
          <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: a }" />
        }
      </div>
    </div>

    <ng-template #tarjeta let-a>
      <div
        class="aviso-entrada pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg"
        [class]="
          a.tono === 'error'
            ? 'border-danger-200 bg-danger-50 text-danger-800'
            : 'border-secondary-200 bg-white text-neutral-800'
        "
        (mouseenter)="avisos.pausar(a.id)"
        (mouseleave)="avisos.reanudar(a.id)"
        (focusin)="avisos.pausar(a.id)"
        (focusout)="avisos.reanudar(a.id)"
      >
        <span
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
          [class]="a.tono === 'error' ? 'bg-danger-600' : 'bg-secondary-500'"
          aria-hidden="true"
          >{{ a.tono === 'error' ? '!' : '✓' }}</span
        >
        <span class="min-w-0 flex-1">{{ a.texto }}</span>
        @if (a.accion; as accion) {
          <button
            type="button"
            class="shrink-0 rounded-lg px-2 py-0.5 font-bold text-primary-700 underline-offset-2 hover:bg-primary-50 hover:underline"
            (click)="ejecutar(a)"
          >
            {{ accion.label }}
          </button>
        }
        <button
          type="button"
          aria-label="Cerrar aviso"
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-60 hover:opacity-100"
          (click)="avisos.cerrar(a.id)"
        >
          <app-icon name="limpiar" class="h-4 w-4" />
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    .aviso-entrada {
      animation: aviso-entrada 180ms ease-out;
    }
    @keyframes aviso-entrada {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .aviso-entrada {
        animation: none;
      }
    }
  `,
})
export class Avisos {
  protected readonly avisos = inject(AvisosService);

  protected exitos(): readonly Aviso[] {
    return this.avisos.avisos().filter((a) => a.tono !== 'error');
  }

  protected errores(): readonly Aviso[] {
    return this.avisos.avisos().filter((a) => a.tono === 'error');
  }

  protected ejecutar(aviso: Aviso): void {
    this.avisos.cerrar(aviso.id);
    aviso.accion?.ejecutar();
  }
}
