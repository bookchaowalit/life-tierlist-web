import Link from 'next/link';
import TierBoard from '@/app/tier-board';
import { site } from '@/lib/site';

export default function Home() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-serif text-lg font-bold text-fg no-underline">
            {site.name}
          </Link>
          <a href="https://github.com/bookchaowalit/life-tierlist-web" className="inline-flex min-h-11 items-center px-2 text-fg">
            โค้ด
          </a>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section aria-labelledby="hero-title" className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">{site.thaiName}</p>
          <h1 id="hero-title" className="mt-2 font-serif text-2xl font-bold sm:text-4xl">
            {site.promise}
          </h1>
          <p className="mt-3 text-fg-muted">{site.description}</p>
        </section>
        <div className="mt-8">
          <TierBoard />
        </div>
      </main>
    </>
  );
}
