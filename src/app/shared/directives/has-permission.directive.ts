import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';

/** Muestra el contenido solo si la sesión tiene el permiso dado. Uso: `*hasPermission="'usuarios.editar'"`. */
@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly hasPermission = input.required<string>();

  private shown = false;

  constructor() {
    effect(() => {
      const permitido = this.auth.hasPermission(this.hasPermission());
      if (permitido && !this.shown) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.shown = true;
      } else if (!permitido && this.shown) {
        this.viewContainer.clear();
        this.shown = false;
      }
    });
  }
}
