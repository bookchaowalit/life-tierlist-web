// Everything a new app renames lives here: change these values first (see README "Start a new app").
export const site = {
  name: 'Tier List',
  thaiName: 'จัดอันดับทุกหมวด',
  promise: 'จัดอันดับ S ถึง D แยกตามหมวด แล้วดูภาพรวมทุกหมวดในหน้าเดียว',
  description: 'สร้างหมวด เพิ่มของ ลากหรือแตะเพื่อจัดแถว ข้อมูลเก็บในเบราว์เซอร์ของคุณ ไม่ส่งไปที่ไหน',
  publicUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
} as const;
