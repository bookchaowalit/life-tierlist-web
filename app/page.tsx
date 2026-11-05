import Link from 'next/link';
import { features, site } from '@/lib/site';

// Replace this page with the app's own content; keep one <main id="main-content"> per page
// so the skip link has a target.
export default function Home() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-serif text-lg font-bold text-fg no-underline">
            {site.name}
          </Link>
          <nav aria-label="เมนูหลัก">
            <a href="#features" className="inline-flex min-h-11 items-center px-2 text-fg">
              ฟีเจอร์
            </a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
        <section aria-labelledby="hero-title" className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">{site.thaiName}</p>
          <h1 id="hero-title" className="mt-2 font-serif text-3xl font-bold sm:text-5xl">
            {site.promise}
          </h1>
          <p className="mt-4 text-lg text-fg-muted">{site.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#features" className="btn btn-primary">ดูสิ่งที่มีให้</a>
            <a href="https://github.com/bookchaowalit/web-starter" className="btn btn-secondary">ดูโค้ด</a>
          </div>
        </section>
        <section id="features" aria-labelledby="features-title" className="mt-16">
          <h2 id="features-title" className="font-serif text-2xl font-bold">มีอะไรให้แล้ว</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="rounded-lg border border-border bg-surface p-5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-fg-muted">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
