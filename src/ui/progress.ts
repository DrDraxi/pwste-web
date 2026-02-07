import { $, show, hide } from './dom';

const section = () => $('progress-section');
const bar = () => $('progress-bar');
const text = () => $('progress-text');

export function showProgress(message: string, percent: number): void {
  show(section());
  bar().style.width = `${Math.min(100, Math.max(0, percent))}%`;
  text().textContent = message;
}

export function hideProgress(): void {
  hide(section());
  bar().style.width = '0%';
  text().textContent = '';
}
