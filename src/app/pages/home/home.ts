import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { itemsVisibles } from '../../core/navigation/navigation';
import { Permisos } from '../../core/permissions/permisos';
import { AuthService } from '../../core/services/auth.service';
import { Icon } from '../../shared/components/icon/icon';
import { Dashboard } from './dashboard/dashboard';

/**
 * Página principal tras el login: saludo, panel de estadísticas de eventos (solo con el permiso
 * de Eventos) y acceso a los módulos que el usuario puede ver.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, Icon, Dashboard],
  templateUrl: './home.html',
})
export class Home {
  protected readonly auth = inject(AuthService);

  protected readonly verEstadisticas = computed(() => this.auth.permisos().includes(Permisos.Eventos));

  protected readonly modulos = computed(() =>
    itemsVisibles(this.auth.permisos()).filter((item) => item.path !== '/'),
  );

  protected readonly saludo = (() => {
    const hora = new Date().getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  })();

  protected readonly fecha = new Date().toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
