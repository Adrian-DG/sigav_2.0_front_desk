import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../core/models/api-error';
import { AuthService } from '../../core/services/auth.service';
import { Button } from '../../shared/components/button/button';
import { TextField } from '../../shared/components/text-field/text-field';

@Component({
  selector: 'app-login',
  standalone: true,
  // FormsModule: NgForm toma el <form> (ngSubmit + preventDefault); sin él, Enter/"Ingresar" hace un submit nativo que recarga /login
  imports: [FormsModule, TextField, Button],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly hidePassword = signal(true);

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly canSubmit = computed(() => this.username().trim().length > 0 && this.password().length > 0 && !this.isSubmitting());

  submit(): void {
    if (!this.canSubmit()) return;

    this.formError.set(null);
    this.isSubmitting.set(true);

    this.auth.login({ username: this.username().trim(), password: this.password() }).subscribe({
      next: () => {
        this.auth.cargarSesion().subscribe({
          next: () => this.redirectTrasLogin(),
          // La sesión no pudo hidratarse (p. ej. red inestable justo después del login), pero el
          // token ya es válido: se navega igual y las guardas/llamadas siguientes reintentarán.
          error: () => this.redirectTrasLogin(),
        });
      },
      error: (error: unknown) => {
        this.formError.set(error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.');
        this.isSubmitting.set(false);
      },
    });
  }

  private redirectTrasLogin(): void {
    this.isSubmitting.set(false);
    this.router.navigateByUrl('/');
  }
}
