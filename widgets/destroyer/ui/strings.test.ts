import { describe, expect, it } from 'vitest';
import { ITEM_KINDS } from '../core/items';
import { TEXT } from './strings';

const THAI = /[฀-๿]/;

describe('TEXT', () => {
  it('has a Thai name and description, and a pixel label, for every item', () => {
    for (const kind of ITEM_KINDS) {
      expect(TEXT.items[kind].name).toMatch(THAI);
      expect(TEXT.items[kind].description).toMatch(THAI);
      expect(TEXT.items[kind].label).toMatch(/^[A-Z!]+$/);
    }
  });

  it('keeps sentences and buttons in Thai', () => {
    for (const line of TEXT.menu.howTo) expect(line).toMatch(THAI);
    for (const text of [TEXT.menu.start, TEXT.hud.quit, TEXT.result.replay, TEXT.result.exit])
      expect(text).toMatch(THAI);
  });
});
