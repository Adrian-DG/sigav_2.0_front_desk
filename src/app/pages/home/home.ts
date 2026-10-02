import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { Button } from '../../shared/components/button/button';

/** Placeholder: demuestra authGuard + AuthService.sesion() hasta que exista el home real. */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Button],
  templateUrl: './home.html',
})
export class Home {
  protected readonly auth = inject(AuthService);
}
