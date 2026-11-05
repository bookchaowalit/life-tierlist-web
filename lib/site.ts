// Everything a new app renames lives here: change these values first (see README "Start a new app").
export const site = {
  name: 'Web Starter',
  thaiName: 'เว็บตั้งต้น',
  promise: 'จุดเริ่มต้นของเว็บใหม่ที่ผ่านมาตรฐาน design floor ตั้งแต่วันแรก',
  description: 'Next.js static export พร้อม Noto Thai, design-floor tokens, Tailwind v4, Sentry และ CI ครบชุด',
  publicUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
} as const;

export const features = [
  { title: 'Design floor', body: 'WCAG 2.2 AA floor ตรวจทุก PR ที่ 5 ความกว้าง' },
  { title: 'ฟอนต์ไทย', body: 'Noto Sans/Serif Thai โหลดจากไฟล์ในเว็บเอง ไม่พึ่ง CDN' },
  { title: 'Sentry', body: 'ส่งเฉพาะ error ตัดข้อมูลผู้ใช้ URL query และ header ออกก่อนส่ง' },
] as const;
