// Item icons for the HUD, rendered from the same pixel sprites the canvas uses.
import { h } from '../../../shared/html';
import { spriteCanvas } from '../../../shared/sprite';
import type { ItemKind } from '../core/items';
import { itemSprite } from '../render/sprites';

const urls = new Map<ItemKind, string>();

function itemIconUrl(kind: ItemKind): string {
  let url = urls.get(kind);
  if (!url) {
    url = spriteCanvas(itemSprite(kind)).toDataURL();
    urls.set(kind, url);
  }
  return url;
}

export function itemIcon(kind: ItemKind, alt = ''): HTMLImageElement {
  return h('img', { class: 'icon', attrs: { src: itemIconUrl(kind), alt, draggable: 'false' } });
}
