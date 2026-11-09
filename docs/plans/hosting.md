# แผน: ให้ฝังวิดเจ็ตด้วยลิงก์แทนการดาวน์โหลดไฟล์

สถานะ: **ทำแล้ว (2026-11-10)** — เหลือขั้นที่ต้องทำบน GitHub เอง (ดูท้ายไฟล์)

## เป้าหมาย

ผู้ใช้ไม่ต้องดาวน์โหลด `destroyer.js` ไปอัปโหลดเอง แค่ก๊อปแท็กนี้ไปวาง:

```html
<script src="https://minttnim19.github.io/web-toybox/v0.1.0/destroyer.js" defer></script>
```

ตัววิดเจ็ตทำงานข้ามโดเมนได้อยู่แล้ว (อ่าน `data-*` จาก `document.currentScript`) จึงไม่ต้องแก้โค้ดวิดเจ็ต

## ทางเลือกที่ดูไว้

| วิธี                        | ข้อดี                                                               | ข้อเสีย                                 |
| --------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| **GitHub Pages + Actions**  | ฟรี, build อัตโนมัติ, ไม่ต้อง commit `dist/`, ขึ้นหน้าคู่มือได้ด้วย | ต้องมี repo บน GitHub และเปิด Pages เอง |
| jsDelivr จาก GitHub         | CDN เร็ว, ลิงก์ล็อกเวอร์ชันตาม tag ได้                              | ต้อง commit `dist/` เข้า repo           |
| npm + jsDelivr / unpkg      | ติดตั้งผ่าน npm ได้ด้วย                                             | ต้องมีบัญชี npm และ publish ทุกเวอร์ชัน |
| Netlify / Vercel / CF Pages | คล้าย GitHub Pages                                                  | เพิ่มบริการภายนอกอีกตัว                 |

แนะนำ: **GitHub Pages + GitHub Actions**

## เรื่องเวอร์ชัน

- ลิงก์ล่าสุด `/destroyer.js` — อัปเดตแล้วทุกเว็บได้ของใหม่ทันที (ถ้ามีบั๊กก็โดนทุกเว็บ)
- ลิงก์ล็อกเวอร์ชัน `/v0.1.0/destroyer.js` — ไม่เปลี่ยนจนกว่าเจ้าของเว็บจะเปลี่ยนลิงก์เอง
- เสนอให้มีทั้งสองแบบ: คู่มือแนะนำลิงก์ล็อกเวอร์ชันสำหรับเว็บจริง

## สิ่งที่ตัดสินใจแล้ว

- repo: `minttnim19/web-toybox` (public) บน GitHub Pages, โดเมน `minttnim19.github.io`
- มีทั้งลิงก์ล่าสุด `/destroyer.js` และลิงก์ล็อกเวอร์ชัน `/vX.Y.Z/destroyer.js` (คู่มือแนะนำแบบล็อกเวอร์ชัน)
- ไม่ใช้โดเมนของตัวเอง

## งานที่ทำแล้ว

- [x] `.github/workflows/pages.yml`: `npm ci` → lint → unit test → e2e → `npm run build:site` → deploy (ทุก push ขึ้น `main`)
- [x] `scripts/build-site.mjs`: วิดเจ็ตล่าสุดที่ root, build ทุก tag `v*` แยกโฟลเดอร์, คัดลอกหน้าคู่มือ
- [x] หน้าคู่มือ: ขั้นตอนติดตั้งเหลือ "คัดลอกแท็กนี้" พร้อมลิงก์จริงและปุ่มคัดลอก, ฟอร์มสร้างโค้ดใช้ลิงก์จริงเป็นค่าเริ่มต้น, FAQ เรื่องลิงก์ล่าสุดกับลิงก์ล็อกเวอร์ชัน
- [x] README: วิธีฝังด้วยลิงก์และวิธีออกเวอร์ชันใหม่

## ที่ต้องทำบน GitHub (ครั้งแรกครั้งเดียว)

- [ ] ตั้ง repo เป็น public (Settings → General → Danger Zone → Change visibility)
- [ ] เปิด Pages: Settings → Pages → Source: **GitHub Actions**
- [ ] สร้าง tag `v0.1.0` แล้ว push: `git tag v0.1.0 && git push origin main --tags`
