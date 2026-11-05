import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { site } from '@/lib/site';
import './globals.css';

const notoSansThai = localFont({
  src: [
    { path: './fonts/NotoSansThai-Variable.woff2', weight: '400', style: 'normal' },
    { path: './fonts/NotoSansThai-Variable.woff2', weight: '600', style: 'normal' },
    { path: './fonts/NotoSansThai-Variable.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans-thai',
  display: 'swap',
});

const notoSerifThai = localFont({
  src: [
    { path: './fonts/NotoSerifThai-Variable.woff2', weight: '400', style: 'normal' },
    { path: './fonts/NotoSerifThai-Variable.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-serif-thai',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const metadata: Metadata = {
  ...(site.publicUrl ? { metadataBase: new URL(site.publicUrl) } : {}),
  title: { default: `${site.name} — ${site.thaiName}`, template: `%s — ${site.name}` },
  description: site.promise,
  openGraph: { type: 'website', locale: 'th_TH', siteName: site.name, description: site.promise },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} ${notoSerifThai.variable}`}>
      <body className="min-h-screen bg-bg text-fg font-sans">
        <a className="skip-link" href="#main-content">ข้ามไปเนื้อหาหลัก</a>
        {children}
      </body>
    </html>
  );
}
