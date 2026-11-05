# web-starter

จุดเริ่มต้นของเว็บใหม่ทุกตัว: Next.js 16 static export ที่ผ่าน [design floor ADR-0007](https://github.com/bookchaowalit/architecture-docs/blob/main/design-floor/FLOOR.md) ทั้ง 12 กฎตั้งแต่ commit แรก

| มีให้แล้ว | ที่ไหน |
|---|---|
| Noto Sans/Serif Thai แบบ self-hosted, `lang="th"`, skip link | `app/layout.tsx`, `app/fonts/` |
| design-floor tokens + Tailwind v4 mapping (copy-in, ห้ามแก้) | `app/design-floor/` |
| ค่าสีและฟอนต์ของแอป (แก้ที่นี่ที่เดียว) | `app/app-theme.css`, บันทึกใน `DESIGN.md` |
| line-height ภาษาไทย ≥ 1.6 / หัวข้อ ≥ 1.3 แทนค่า default ของ Tailwind | `app/globals.css` |
| Sentry เฉพาะ error พร้อม scrubber (ตัด request, user, query, header) | `lib/sentry.ts`, `instrumentation-client.ts` |
| glob 14 override ใต้ Sentry bundler plugin (GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249) | `package.json` `overrides` |
| CI: lint, typecheck, Vitest coverage ≥ 80 %, build, security scan, design floor | `.github/workflows/ci.yml` |
| Tests: หน้า, layout, และไฟล์ design-floor ที่ vendor มายังไม่ถูกแก้ | `tests/` |

## Start a new app

1. GitHub: **Use this template** → ตั้งชื่อ repo (หรือ `gh repo create bookchaowalit/<name> --template bookchaowalit/web-starter --public --clone`)
2. แก้ `name` ใน `package.json` และค่าใน `lib/site.ts`
3. ตั้งสีใน `app/app-theme.css` แล้วเขียนค่าเดียวกันลงตาราง Tokens ใน `DESIGN.md` (contrast ข้อความ ≥ 4.5:1)
4. เขียน `PRODUCT.md` (ใคร ปัญหาอะไร สำเร็จวัดยังไง) และแทนเนื้อหาใน `app/page.tsx`
5. เพิ่ม route ใหม่ทุกหน้าลงใน `design-floor.json` `routes`
6. Sentry: สร้าง project แล้วใส่ `NEXT_PUBLIC_SENTRY_DSN` ใน Vercel (ว่าง = ปิด)
7. Vercel: import repo แล้ว push = deploy; เพิ่ม deploy-smoke ตามแบบ repo อื่นถ้าเป็นเว็บ production

```bash
npm install
npm run dev
```

## Checks (เหมือน CI)

```bash
npm run lint && npm run typecheck && npx vitest run --coverage && npm run check
node ../architecture-docs/design-floor/check.mjs --config design-floor.json
```

UI change ทุกครั้ง: รัน `ui_review.mjs` ที่ 320/375/768/1024/1440 ดูทุกภาพ แล้ว `ui_signoff.py` ก่อน push (hook จะ block ถ้ายังไม่ sign off)

## ถ้าแอปต้องมี server

ลบ `output: 'export'` ใน `next.config.ts`, เปลี่ยน `start` เป็น `next start -p 3000` และเปลี่ยน `design-floor.json`:

```json
"target": { "serve": ["npm", "run", "start"], "url": "http://127.0.0.1:3000/", "timeoutSeconds": 120 }
```

## Private repo

เปลี่ยน job ใน `ci.yml` ไปใช้ self-hosted runner ตาม CI hosting policy และรัน design floor ในเครื่อง (runner ยังไม่มี library ของ Chromium)

## อัปเดตไฟล์ design-floor

copy `tokens.css` และ `tailwind/v4.css` เวอร์ชันใหม่จาก `architecture-docs/design-floor/` ทับของเดิมทั้งไฟล์ อ่าน `CHANGELOG.md` ที่นั่นก่อน (major = เปลี่ยนชื่อ token)
