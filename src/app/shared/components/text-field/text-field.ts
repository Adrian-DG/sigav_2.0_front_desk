import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

let nextId = 0;

/** Campo de texto con label, ícono y error, equivalente al TextField de Mobile (components/ui/text-field.tsx). */
@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './text-field.html',
})
export class TextField {
  readonly id = `text-field-${nextId++}`;

  readonly label = input.required<string>();
  readonly type = input<'text' | 'password'>('text');
  readonly placeholder = input('');
  readonly autocomplete = input<string>('off');
  readonly disabled = input(false);
  readonly errorText = input<string | null>(null);

  readonly value = model('');
}
