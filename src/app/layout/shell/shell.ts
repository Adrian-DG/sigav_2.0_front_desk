import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidebar } from '../sidebar/sidebar';

/** Marco de todas las páginas con sesión: menú fijo a la izquierda y el contenido desplazable a la derecha. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Sidebar],
  template: `
    <app-sidebar />
    <main class="min-h-screen pl-[72px] lg:pl-64">
      <router-outlet />
    </main>
  `,
})
export class Shell {}
