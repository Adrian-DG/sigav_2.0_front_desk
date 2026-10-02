import { Component, input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 disabled:bg-primary-300',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 disabled:bg-secondary-300',
  ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 disabled:text-neutral-300',
};

/** Botón equivalente al Button de Mobile (components/ui/button.tsx): mismas variantes, mismo loading/disabled. */
@Component({
  selector: 'app-button',
  standalone: true,
  templateUrl: './button.html',
})
export class Button {
  readonly variant = input<Variant>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly loading = input(false);
  readonly disabled = input(false);

  get classes(): string {
    return VARIANT_CLASSES[this.variant()];
  }
}
