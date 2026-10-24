import { expect, test } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
const css = readFileSync(join(__dirname, "../../src/v2/controls.css"), "utf8");
test("buttons are cut-corner", () => {
  expect(css).toMatch(/\.f-btn[^{]*\{[^}]*clip-path:\s*polygon/);
});
test("focused inputs get the yellow offset shadow", () => {
  expect(css).toMatch(
    /\.f-input:focus[^{]*\{[^}]*box-shadow:\s*3px 3px 0 var\(--f-sun\)/,
  );
});
test("focused buttons show a ring that clip-path cannot hide", () => {
  const rule = css.match(/\.f-btn:focus-visible[^{]*\{[^}]*\}/)![0];
  expect(rule).toMatch(/clip-path:\s*none|inset/);
});
test("touch targets stay 44px", () => {
  expect(css).toMatch(/\.f-btn[^{]*\{[^}]*min-height:\s*44px/);
  expect(css).toMatch(/\.f-input[^{]*\{[^}]*min-height:\s*44px/);
});
