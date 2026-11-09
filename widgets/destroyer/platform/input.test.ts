import { describe, expect, it } from 'vitest';
import { slotForKey } from './input';

describe('slotForKey', () => {
  it('maps the 1-3 keys by physical position, whatever the layout types', () => {
    expect(slotForKey('Digit1', '1')).toBe(0);
    expect(slotForKey('Digit1', 'ๅ')).toBe(0); // Thai layout
    expect(slotForKey('Digit2', '/')).toBe(1); // Thai layout
    expect(slotForKey('Digit3', '-')).toBe(2); // Thai layout
  });

  it('accepts the numeric keypad', () => {
    expect(slotForKey('Numpad1', '1')).toBe(0);
    expect(slotForKey('Numpad3', '3')).toBe(2);
  });

  it('ignores other keys', () => {
    expect(slotForKey('Digit4', '4')).toBeNull();
    expect(slotForKey('Digit0', '0')).toBeNull();
    expect(slotForKey('KeyA', '1')).toBeNull();
  });

  it('falls back to the typed character when no code is reported', () => {
    expect(slotForKey('', '2')).toBe(1);
    expect(slotForKey('', 'x')).toBeNull();
  });
});
