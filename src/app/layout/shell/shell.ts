import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Avisos } from '../../shared/components/avisos/avisos';
import { AvisoVencimiento } from '../aviso-vencimiento/aviso-vencimiento';
import { Sidebar } from '../sidebar/sidebar';

/** Marco de todas las páginas con sesión: menú fijo a la izquierda y el contenido desplazable a la derecha. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Avisos, AvisoVencimiento],
  template: `
    <app-sidebar />
    <main class="min-h-screen pl-[72px] lg:pl-64">
      <app-aviso-vencimiento />
      <router-outlet />
    </main>
    <app-avisos />
  `,
})
export class Shell {}
