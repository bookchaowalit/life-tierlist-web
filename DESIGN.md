# DESIGN

Floor: [ADR-0007 design floor 1.0.0](https://github.com/bookchaowalit/architecture-docs/blob/main/design-floor/FLOOR.md) — WCAG 2.2 AA, ตรวจโดย `design-floor` job ใน CI

## Tokens

Vendored `app/design-floor/tokens.css` (`css-vars` 1.0.0) และ `app/design-floor/tailwind/v4.css` (`tailwind-v4` 1.0.0) แก้ไม่ได้ ค่าของแอปนี้อยู่ใน `app/app-theme.css`:

| Token | ค่า | หมายเหตุ |
|---|---|---|
| `--color-bg` | `#f7f6f2` | พื้นหลัง |
| `--color-surface` | `#ffffff` | การ์ด |
| `--color-fg` | `#1d211f` | ข้อความหลัก |
| `--color-fg-muted` | `#555b57` | ข้อความรอง (≥ 4.5:1 บน bg และ surface) |
| `--color-accent` / `--color-focus` | `#1f5f4a` | ปุ่มหลัก, ลิงก์เด่น, focus ring |
| `--color-accent-fg` | `#ffffff` | ข้อความบนปุ่มหลัก |
| `--color-border` | `#c9cbc4` | เส้นขอบ |
| `--font-sans` / `--font-serif` | Noto Sans Thai / Noto Serif Thai ผ่าน `next/font/local` | |

Line-height: ทุกขนาด text ของ Tailwind ใช้ `--leading-thai` (1.7) หรือ `--leading-thai-heading` (1.35) แทนค่า default (`app/globals.css`)

Dark mode: ไม่มี (เพิ่มได้ด้วย `data-theme="dark"` ตาม `tailwind/v4.css`) Waivers: ไม่มี

## Components

- `.btn` + `.btn-primary` / `.btn-secondary`: สูงอย่างน้อย 44 px
- `.skip-link`: ลิงก์แรกของทุกหน้า ไปที่ `#main-content`
