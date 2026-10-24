import { expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

// Next.js only allows first-party global CSS imports in pages/_app.tsx (jest doesn't enforce it).
const ROOT = join(__dirname, "../..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(t|j)sx?$/.test(f) ? [p] : [];
  });

test("global CSS is only imported from pages/_app.tsx", () => {
  const bad = [...files(join(ROOT, "src")), ...files(join(ROOT, "pages"))]
    .filter((p) => !p.endsWith(join("pages", "_app.tsx")))
    .filter((p) => /^import\s+['"](\.|\/)[^'"]*(?<!\.module)\.css['"]/m.test(readFileSync(p, "utf8")))
    .map((p) => relative(ROOT, p));
  expect(bad).toEqual([]);
});
