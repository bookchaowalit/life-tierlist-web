import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NotFound from "@/app/not-found";
import Home from "@/app/page";
import RootLayout from "@/app/layout";
import { features, site } from "@/lib/site";

// next/font/local only works inside a Next build; the layout just needs the CSS variable names.
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font-var" }) }));

describe("pages", () => {
  it("home renders the promise, every feature and one main landmark", () => {
    const html = renderToString(<Home />);
    expect(html).toContain(site.promise);
    for (const feature of features) expect(html).toContain(feature.title);
    expect(html.match(/<main id="main-content"/g)).toHaveLength(1);
  });

  it("not-found has a main landmark and a way home", () => {
    const html = renderToString(<NotFound />);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('href="/"');
  });

  it("layout sets lang=th and the skip link first", () => {
    const html = renderToString(<RootLayout><main id="main-content" /></RootLayout>);
    expect(html).toContain('<html lang="th"');
    expect(html.indexOf('class="skip-link"')).toBeLessThan(html.indexOf("<main"));
  });
});

describe("vendored design-floor files", () => {
  // The first line carries the hash of the file body; an edited copy no longer matches it.
  for (const file of ["app/design-floor/tokens.css", "app/design-floor/tailwind/v4.css"]) {
    it(`${file} is unedited`, () => {
      const text = readFileSync(file, "utf8");
      const [header, ...rest] = text.split("\n");
      const claimed = /sha256:([0-9a-f]{64})/.exec(header)?.[1];
      expect(claimed).toBeDefined();
      expect(createHash("sha256").update(rest.join("\n")).digest("hex")).toBe(claimed);
    });
  }
});
