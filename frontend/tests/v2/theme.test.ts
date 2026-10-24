import { expect, test } from "@jest/globals";
import { fridgeTheme } from "@/v2/theme";

test("theme uses the new font stack", () => {
  expect(fridgeTheme.fontFamily).toContain("Inter");
  expect(fridgeTheme.headings?.fontFamily).toContain("Space Grotesk");
  expect(JSON.stringify(fridgeTheme)).not.toMatch(/Fredoka|Nunito/);
});

test('controls get gamer-cut classNames', () => {
  const c = fridgeTheme.components as Record<string, { classNames?: unknown }>
  expect(c.Button?.classNames).toMatchObject({ root: 'f-btn' })
  expect(c.Input?.classNames).toMatchObject({ input: 'f-input' })
  expect(c.InputWrapper?.classNames).toMatchObject({ label: 'f-label' })
  expect(c.SegmentedControl?.classNames).toMatchObject({ root: 'f-seg' })
  expect(c.Switch?.classNames).toMatchObject({ track: 'f-switch' })
  expect(c.Checkbox?.classNames).toMatchObject({ input: 'f-check' })
  expect(c.Chip?.classNames).toMatchObject({ label: 'f-chipctl' })
})

test('drawers and modals use the themed sheet classes', () => {
  const c = fridgeTheme.components as Record<string, { classNames?: unknown }>
  expect(c.Drawer?.classNames).toMatchObject({ content: 'f-sheet', title: 'f-sheet-title' })
  expect(c.Modal?.classNames).toMatchObject({ content: 'f-sheet', title: 'f-sheet-title' })
})
