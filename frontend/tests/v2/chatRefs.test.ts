import { expect, test } from "@jest/globals";
import { validRef } from "@/v2/hooks/useChat";

jest.mock("@/v2/api", () => ({ api: jest.fn() }));

test("only numeric ids or family make a thread path", () => {
  expect(validRef("private", "12")).toBe(true);
  expect(validRef("chore", "7")).toBe(true);
  expect(validRef("family", "family")).toBe(true);
  expect(validRef("private", "../../devices/1")).toBe(false);
  expect(validRef("chore", "7?x=1")).toBe(false);
  expect(validRef("family", "1")).toBe(false);
  expect(validRef("private", "")).toBe(false);
});
