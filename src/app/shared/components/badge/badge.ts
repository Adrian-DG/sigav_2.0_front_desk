import { Component, computed, input } from '@angular/core';

export type TonoBadge = 'primary' | 'secondary' | 'accent' | 'danger' | 'warning' | 'neutral';

const TONOS: Record<TonoBadge, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-primary-100',
  secondary: 'bg-secondary-50 text-secondary-700 ring-secondary-100',
  accent: 'bg-accent-50 text-accent-700 ring-accent-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  warning: 'bg-warning-50 text-warning-800 ring-warning-100',
  neutral: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
};

/** Etiqueta corta de estado o categoría, equivalente al Tag de Mobile (components/ui/tag.tsx). */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<ng-content />`,
  host: { '[class]': 'clases()' },
})
export class Badge {
  readonly tono = input<TonoBadge>('neutral');

  protected readonly clases = computed(
    () =>
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ring-inset ' +
      TONOS[this.tono()],
  );
}
