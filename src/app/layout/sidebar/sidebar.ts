import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { itemsVisibles } from '../../core/navigation/navigation';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/components/icon/icon';

/**
 * Menú lateral fijo: siempre visible. En pantallas grandes muestra íconos y nombres; por debajo
 * de lg se reduce a un riel de íconos (con title/aria-label) en vez de ocultarse.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  protected readonly auth = inject(AuthService);

  protected readonly items = computed(() => itemsVisibles(this.auth.permisos()));

  protected readonly iniciales = computed(() => {
    const nombre = this.auth.sesion()?.nombre?.trim();
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/);
    return (
      (partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')
    ).toUpperCase();
  });
}
