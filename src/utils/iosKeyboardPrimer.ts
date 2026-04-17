/**
 * iOS Safari only opens the on-screen keyboard when `.focus()` happens
 * synchronously within a user gesture. If the target input is mounted later
 * (e.g. after a modal opens via setState), the gesture context is lost by the
 * time we try to focus it and the keyboard stays closed.
 *
 * Workaround: synchronously focus a persistent off-screen input in the same
 * click handler that opens the modal. That primes the keyboard. When the real
 * input focuses (even a tick later), iOS transfers the keyboard to it instead
 * of closing and reopening.
 */

let primer: HTMLInputElement | null = null;

function ensurePrimer(): HTMLInputElement {
  if (primer) return primer;
  const el = document.createElement('input');
  el.type = 'text';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('tabindex', '-1');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  primer = el;
  return el;
}

export function primeKeyboard(): void {
  try {
    ensurePrimer().focus();
  } catch {
    // ignore; worst case the keyboard just doesn't open automatically
  }
}
