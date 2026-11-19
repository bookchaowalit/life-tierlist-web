import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

vi.mock("next/font/local", () => ({ default: () => ({ variable: "font-var" }) }));
const { metadata } = await import("@/app/layout");

// Interface coverage (ADR-0015 §1.2, free tool): legal link, status, contact, and SEO basics.
describe("footer and SEO basics", () => {
  it("home ends with a footer linking the hub, privacy, status and contact", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("<footer");
    expect(html).toContain('href="https://bookchaowalit.com/privacy"');
    expect(html).toMatch(/href="https:\/\/bookchaowalit.com\/"[^>]*>bookchaowalit.com<\/a>/);
    expect(html).toContain('href="https://monitor.bookchaowalit.com/"');
    expect(html).toContain('href="mailto:bookchaowalit.work@gmail.com"');
  });

  it("has an Open Graph title, robots.txt and a sitemap", () => {
    expect(metadata.openGraph?.title).toBeTruthy();
    const r = robots();
    expect(r.sitemap).toMatch(/^https:\/\/.+\/sitemap\.xml$/);
    expect(sitemap()[0].url).toMatch(/^https:\/\//);
  });
});
