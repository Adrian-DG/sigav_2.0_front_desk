import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { mensajeDeError } from '../../core/utils/formato';
import { AuthService } from '../../core/services/auth.service';
import { AvisosService } from '../../core/services/avisos.service';
import { Button } from '../../shared/components/button/button';
import { Dialogo, DialogoAcciones } from '../../shared/components/dialogo/dialogo';
import { TextField } from '../../shared/components/text-field/text-field';

/** Desde cuándo se avisa en la franja superior. */
const AVISO_MS = 15 * 60_000;
/** Desde cuándo se abre solo el diálogo de renovar (por encima de cualquier formulario abierto). */
const DIALOGO_MS = 5 * 60_000;

/**
 * El token web dura unas horas y no hay refresh token: al vencer, el siguiente 401 cerraba la
 * sesión y se perdía lo que hubiera en pantalla (un formulario a medio llenar). Aquí se avisa
 * antes (franja a los 15 min, diálogo a los 5) y se renueva con la contraseña sin salir de la
 * página. Si aun así vence, se cierra la sesión recordando la página para volver a ella.
 */
@Component({
  selector: 'app-aviso-vencimiento',
  standalone: true,
  imports: [FormsModule, Button, Dialogo, DialogoAcciones, TextField],
  template: `
    @if (mostrarFranja()) {
      <div
        class="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-900"
        role="status"
      >
        <span>
          <strong>Su sesión vence en {{ minutos() }} {{ minutos() === 1 ? 'minuto' : 'minutos' }}.</strong>
          Renuévela para no perder lo que esté haciendo.
        </span>
        <button type="button" class="font-bold underline underline-offset-2 hover:text-warning-700" (click)="abrir()">
          Renovar sesión
        </button>
      </div>
    }

    <app-dialogo
      [abierto]="dialogoAbierto()"
      titulo="Renovar sesión"
      [descripcion]="
        restante() > 0
          ? 'Su sesión vence en ' + minutos() + (minutos() === 1 ? ' minuto' : ' minutos') + '. Lo que tenga abierto se conserva.'
          : 'Su sesión venció.'
      "
      [ocupado]="renovando()"
      (cerrar)="cerrarDialogo()"
    >
      <form class="flex flex-col gap-4" (ngSubmit)="renovar()">
        @if (!auth.usuario()) {
          <app-text-field
            label="Usuario"
            autocomplete="username"
            [disabled]="renovando()"
            [value]="usuario()"
            (valueChange)="usuario.set($event)"
          />
        } @else {
          <p class="text-sm text-neutral-600">
            Usuario: <strong class="text-neutral-900">{{ auth.usuario() }}</strong>
          </p>
        }
        <app-text-field
          label="Contraseña"
          type="password"
          autocomplete="current-password"
          [disabled]="renovando()"
          [errorText]="error()"
          [value]="password()"
          (valueChange)="password.set($event); error.set(null)"
        />
        <!-- Enter en la contraseña envía el formulario -->
        <button type="submit" class="hidden" tabindex="-1" aria-hidden="true"></button>
      </form>

      <app-button dialogoAcciones variant="ghost" [bloque]="false" [disabled]="renovando()" (click)="cerrarDialogo()">
        Más tarde
      </app-button>
      <app-button dialogoAcciones [bloque]="false" [loading]="renovando()" [disabled]="!puedeRenovar()" (click)="renovar()">
        Renovar
      </app-button>
    </app-dialogo>
  `,
})
export class AvisoVencimiento {
  protected readonly auth = inject(AuthService);
  private readonly avisos = inject(AvisosService);

  private readonly ahora = signal(Date.now());
  protected readonly restante = computed(() => {
    const expiracion = this.auth.expiracion();
    return expiracion === null ? Infinity : expiracion - this.ahora();
  });
  protected readonly minutos = computed(() => Math.max(1, Math.ceil(this.restante() / 60_000)));
  protected readonly mostrarFranja = computed(() => this.restante() <= AVISO_MS);

  protected readonly dialogoAbierto = signal(false);
  /** Ya se abrió solo una vez para este token: si lo cierra, no se vuelve a imponer. */
  private abiertoAutomatico = false;

  protected readonly usuario = signal('');
  protected readonly password = signal('');
  protected readonly renovando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly puedeRenovar = computed(
    () => this.password().length > 0 && (!!this.auth.usuario() || this.usuario().trim().length > 0) && !this.renovando(),
  );

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));

    // Un token nuevo (renovado) reinicia el aviso automático
    effect(() => {
      this.auth.expiracion();
      untracked(() => (this.abiertoAutomatico = false));
    });

    effect(() => {
      const restante = this.restante();
      untracked(() => {
        if (restante <= 0 && !this.renovando()) {
          this.auth.logout({ vencida: true });
        } else if (restante <= DIALOGO_MS && !this.abiertoAutomatico) {
          this.abiertoAutomatico = true;
          this.abrir();
        }
      });
    });
  }

  protected abrir(): void {
    this.password.set('');
    this.error.set(null);
    this.dialogoAbierto.set(true);
  }

  protected cerrarDialogo(): void {
    if (!this.renovando()) this.dialogoAbierto.set(false);
  }

  protected renovar(): void {
    if (!this.puedeRenovar()) return;
    this.renovando.set(true);
    this.error.set(null);
    const usuario = this.auth.usuario() ?? this.usuario().trim();
    this.auth.renovar(this.password(), usuario).subscribe({
      next: () => {
        this.renovando.set(false);
        this.dialogoAbierto.set(false);
        this.password.set('');
        this.ahora.set(Date.now());
        this.avisos.exito('Sesión renovada. Puede continuar.');
      },
      error: (error: unknown) => {
        this.renovando.set(false);
        this.error.set(mensajeDeError(error) ?? 'No se pudo renovar la sesión.');
      },
    });
  }
}
