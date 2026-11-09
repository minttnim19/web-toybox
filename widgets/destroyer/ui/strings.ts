// Every piece of text the player sees, in one place. Thai for sentences and buttons;
// short pixel-font labels stay in English (the pixel font has no Thai glyphs).
import { MAGNET_DURATION, RAPID_DURATION, RAPID_FIRE_RATE, type ItemKind } from '../core/items';
import type { EndReason } from '../core/state';

export const TEXT = {
  launcher: {
    label: '💥 DESTROY',
    title: 'เล่นเกมทำลายหน้าเว็บนี้',
  },

  menu: {
    dialogLabel: 'เมนูเกม',
    title: 'DESTROY!',
    close: 'ปิด',
    howTo: [
      'ขยับเมาส์หรือลากนิ้ว ยานจะบินตาม และยิงสิ่งที่อยู่ใกล้ ๆ เอง',
      'กล่องใหญ่ต้องทำลายของข้างในให้หมดก่อน ถึงจะยิงเข้า',
      'บินไปเก็บไอเทม แล้วกด 1–3 เพื่อใช้ (มือถือ: แตะช่องไอเทม)',
      'พายานไปใกล้ขอบจอบนหรือล่างเพื่อเลื่อนหน้า',
    ],
    itemsLabel: 'ITEMS',
    timeLabel: 'TIME',
    minutes: (n: number) => `${n} นาที`,
    start: 'เริ่มเลย!',
  },

  hud: {
    destroyed: 'DESTROYED',
    time: 'TIME',
    score: 'SCORE',
    combo: 'COMBO',
    soundOn: 'SOUND ON',
    soundOff: 'SOUND OFF',
    quit: 'ออก',
    quitTitle: 'ออกจากเกมและคืนหน้าเว็บ (Esc)',
    emptySlot: 'ช่องว่าง',
    full: 'FULL',
  },

  result: {
    dialogLabel: 'ผลการเล่น',
    title: { clear: 'CLEAR!', timeup: 'TIME UP!' } satisfies Record<EndReason, string>,
    score: 'คะแนน',
    destroyed: 'ทำลายไป',
    timeUsed: 'เวลาที่ใช้',
    maxCombo: 'คอมโบสูงสุด',
    timeBonus: 'โบนัสเวลา',
    best: 'สถิติสูงสุด',
    newBest: 'NEW!',
    replay: 'เล่นอีกครั้ง',
    exit: 'กลับไปที่หน้าเว็บ',
  },

  /** Name and description in the menu and HUD; `label` floats over the canvas (pixel font). */
  items: {
    bomb: { name: 'ระเบิด', description: 'ทำลายหนักทุกอย่างรอบตัวยาน', label: 'BOMB' },
    rapid: {
      name: 'ยิงรัว',
      description: `ยิงเร็วขึ้น ${RAPID_FIRE_RATE} เท่า ${RAPID_DURATION} วินาที`,
      label: 'RAPID!',
    },
    laser: { name: 'เลเซอร์', description: 'ลำแสงกากบาททะลุทุกอย่างที่ขวาง', label: 'LASER' },
    magnet: {
      name: 'แม่เหล็ก',
      description: `ดูดไอเทมใกล้ ๆ เข้าหายาน ${MAGNET_DURATION} วินาที`,
      label: 'MAGNET!',
    },
  } satisfies Record<ItemKind, { name: string; description: string; label: string }>,
} as const;
