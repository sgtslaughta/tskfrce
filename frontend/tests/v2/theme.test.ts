import { expect, test } from "@jest/globals";
import { fridgeTheme } from "@/v2/theme";

test("theme uses the new font stack", () => {
  expect(fridgeTheme.fontFamily).toContain("Inter");
  expect(fridgeTheme.headings?.fontFamily).toContain("Space Grotesk");
  expect(JSON.stringify(fridgeTheme)).not.toMatch(/Fredoka|Nunito/);
});
