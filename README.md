# web-toybox

คอลเลกชันของวิดเจ็ตเล็ก ๆ ที่ฝังลงหน้าเว็บไหนก็ได้ด้วยแท็ก `<script>` เพียงบรรทัดเดียว
แต่ละวิดเจ็ตถูก build เป็นไฟล์ JavaScript ไฟล์เดียว (IIFE) ที่ไม่ต้องพึ่งไลบรารีอื่นตอนรัน
และแยก UI ของตัวเองไว้ใน Shadow DOM จึงไม่ชนกับ CSS ของเว็บที่ฝัง

## วิดเจ็ตที่มี

| ชื่อ        | คำอธิบาย                                                                             | ตัวอย่าง                                  |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| `destroyer` | เกมยิงยานอวกาศแบบพิกเซล ทำลายหน้าเว็บที่คุณเปิดอยู่ (แค่ภาพ กดออกแล้วกลับเหมือนเดิม) | [examples/destroyer](examples/destroyer/) |

## เริ่มต้นใช้งาน

ต้องมี Node.js 20 ขึ้นไป

```bash
npm install
npm run dev     # เปิดหน้าตัวอย่างพร้อม hot reload (http://localhost:5173/destroyer/)
npm run build   # build วิดเจ็ตทั้งหมดไปที่ dist/<ชื่อ>.js
npm run lint    # ตรวจ type, ESLint และ Prettier
npm run test    # รัน unit test ด้วย Vitest
npm run test:e2e  # ทดสอบในเบราว์เซอร์จริงด้วย Playwright กับไฟล์ที่ build แล้ว
npm run format  # จัดรูปแบบโค้ดด้วย Prettier
```

ตอน `npm run dev` ไฟล์ `/<ชื่อวิดเจ็ต>.js` จะถูก bundle สด ๆ จากซอร์สในรูปแบบเดียวกับไฟล์จริงใน `dist/`
หน้าตัวอย่างจึงฝังวิดเจ็ตด้วย `<script>` ธรรมดาเหมือนผู้ใช้จริง แก้โค้ดเมื่อไรหน้าจะรีโหลดให้อัตโนมัติ

## วิธีฝังวิดเจ็ตลงเว็บ

วางบรรทัดนี้ไว้ก่อนปิด `</body>` ไม่ต้องดาวน์โหลดไฟล์เอง

```html
<script src="https://minttnim19.github.io/web-toybox/v0.1.0/destroyer.js" defer></script>
```

| ลิงก์                                                         | ใช้เมื่อ                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `https://minttnim19.github.io/web-toybox/v0.1.0/destroyer.js` | เว็บที่ใช้งานจริง: ล็อกเวอร์ชันไว้ ไฟล์ไม่เปลี่ยนแม้มีเวอร์ชันใหม่ |
| `https://minttnim19.github.io/web-toybox/destroyer.js`        | อยากได้ของใหม่ล่าสุดเสมอ (อัปเดตทุกครั้งที่ push ขึ้น `main`)      |

อยากเก็บไฟล์ไว้บนเว็บตัวเองก็ได้: รัน `npm run build` แล้วนำ `dist/destroyer.js` ไปวาง จากนั้นใช้ `src="destroyer.js"`

คู่มือพร้อมตัวอย่างให้ลองเล่น: <https://minttnim19.github.io/web-toybox/destroyer/>

ตั้งค่าได้ผ่าน data-attribute บนแท็ก `<script>`

| attribute       | ค่าเริ่มต้น    | ความหมาย                                                                  |
| --------------- | -------------- | ------------------------------------------------------------------------- |
| `data-position` | `bottom-right` | มุมของปุ่มเปิดเกม: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-scope`    | `body`         | CSS selector จำกัดพื้นที่ที่ทำลายได้                                      |

ใส่ `data-wd-ignore` ให้ element ที่ไม่ต้องการให้ถูกทำลาย เช่น `<div data-wd-ignore>…</div>`

## โครงสร้างโปรเจกต์

```
widgets/<ชื่อ>/     ซอร์สของแต่ละวิดเจ็ต (entry point คือ index.ts)
shared/             โค้ดที่ใช้ร่วมกัน: ตัววาด pixel sprite, เสียง 8-bit, ตัวช่วย HUD ใน Shadow DOM, ตัวสแกน DOM
examples/<ชื่อ>/    หน้าตัวอย่างของแต่ละวิดเจ็ต
scripts/            สคริปต์ build
docs/plans/         แผนงานที่ยังไม่ได้ทำ (เช่น ให้ฝังด้วยลิงก์แทนการดาวน์โหลด)
dist/               ไฟล์ที่ build แล้ว (ไม่ถูก commit)
```

ภายในวิดเจ็ตแบ่งเป็นชั้น ๆ

- `core/` — ตรรกะของเกมล้วน ๆ ห้ามแตะ DOM, canvas หรือ `window` (ESLint บังคับไว้) จึงเทสได้ง่าย
- `platform/` — โค้ดที่คุยกับเบราว์เซอร์ เช่น สแกนหน้าเว็บ รับ input เก็บ localStorage
- `render/` — วาดภาพลง canvas
- `ui/` — HUD และเมนูใน Shadow DOM

## เผยแพร่ (GitHub Pages)

ทุกครั้งที่ push ขึ้น `main` GitHub Actions ([.github/workflows/pages.yml](.github/workflows/pages.yml))
จะรัน lint, unit test, e2e แล้ว build เว็บด้วย `npm run build:site` และขึ้น GitHub Pages

ออกเวอร์ชันใหม่:

1. แก้เลข `version` ใน `package.json` และลิงก์ `/vX.Y.Z/` ในหน้าคู่มือกับ README (`build:site` จะเตือนถ้าไม่ตรงกัน)
2. commit แล้วสร้าง tag: `git tag vX.Y.Z`
3. push ทั้ง branch และ tag: `git push origin main --tags`

ลิงก์ล็อกเวอร์ชัน `/vX.Y.Z/` ถูก build จาก tag นั้นเสมอ จึงไม่เปลี่ยนแม้โค้ดบน `main` จะเปลี่ยน

## เพิ่มวิดเจ็ตใหม่

1. สร้างโฟลเดอร์ `widgets/<ชื่อ>/` พร้อมไฟล์ `index.ts` (ชื่อใช้ตัวพิมพ์เล็ก ตัวเลข และ `-` เท่านั้น)
2. อ่านตัวเลือกจาก `document.currentScript.dataset` ตอนที่สคริปต์เริ่มทำงาน
3. สร้างหน้าตัวอย่างที่ `examples/<ชื่อ>/index.html` แล้วฝังด้วย `<script src="<ชื่อ>.js" defer></script>`
4. เพิ่มลิงก์ใน `examples/index.html` และในตารางวิดเจ็ตด้านบน
5. รัน `npm run build` จะได้ `dist/<ชื่อ>.js` โดยอัตโนมัติ ไม่ต้องแก้ config

ข้อควรจำ: ห้ามมี dependency ตอนรัน (ทุกอย่างต้อง bundle รวมในไฟล์เดียว), UI ทั้งหมดอยู่ใน Shadow DOM
และเทสของ `core/` วางไว้ข้างไฟล์ในชื่อ `*.test.ts`
เทสในเบราว์เซอร์อยู่ที่ `e2e/` (ครั้งแรกให้รัน `npx playwright install chromium`)

## License

MIT
