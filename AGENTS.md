# Agent instructions

- ห้ามแก้ไฟล์ใน `app/design-floor/` (copy-in จาก architecture-docs; test เช็ก hash) ค่าของแอปแก้ที่ `app/app-theme.css` แล้วอัปเดตตาราง Tokens ใน `DESIGN.md`
- ทุกหน้าใหม่: มี `<main id="main-content">` หนึ่งอัน, เพิ่ม route ใน `design-floor.json`, และมี test ใน `tests/`
- ข้อความภาษาไทยห้าม letter-spacing ติดลบ; ใช้ขนาด text ของ Tailwind ซึ่งตั้ง line-height ไทยไว้แล้ว ถ้าตั้ง `leading-*` เองต้อง ≥ 1.6 (หัวข้อ ≥ 1.3)
- ปุ่มและลิงก์ที่กดได้สูงอย่างน้อย 44 px บนมือถือ; ห้ามเอา focus outline ออก
- Sentry: ใช้ `lib/sentry.ts` เท่านั้น ห้ามเปิด tracing, replay หรือส่ง request/user data
- ห้ามโหลดฟอนต์หรือสคริปต์จาก CDN ภายนอกตอน runtime
- ก่อนแก้ Next.js อ่านเอกสารใน `node_modules/next/dist/docs/` ที่เกี่ยวข้อง
- ก่อน push: `npm run lint && npm run typecheck && npx vitest run --coverage && npm run check`, design floor ผ่าน, และ UI review + `ui_signoff.py` สำหรับ UI change
