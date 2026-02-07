/**
 * Type-safe DOM element getter.
 */
export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

export function $input(id: string): HTMLInputElement {
  return $(id) as HTMLInputElement;
}

export function $img(id: string): HTMLImageElement {
  return $(id) as HTMLImageElement;
}

export function show(el: HTMLElement): void {
  el.classList.remove('hidden');
}

export function hide(el: HTMLElement): void {
  el.classList.add('hidden');
}
