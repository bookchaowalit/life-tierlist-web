import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <h1 className="font-serif text-3xl font-bold">ไม่พบหน้านี้</h1>
      <p className="mt-4 text-fg-muted">ลิงก์อาจเปลี่ยนไปแล้ว</p>
      <Link href="/" className="btn btn-primary mt-8">กลับหน้าแรก</Link>
    </main>
  );
}
