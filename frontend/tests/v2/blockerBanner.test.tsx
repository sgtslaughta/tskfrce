import { expect, test } from "@jest/globals";
import type { Mock } from "jest-mock";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/v2/api";
import { BlockerBanner } from "@/v2/components/BlockerBanner";

jest.mock("@/v2/api", () => ({ api: jest.fn() }));
const apiMock = api as unknown as Mock<(path: string) => Promise<unknown>>;

const renderWith = (status: object) => {
  apiMock.mockResolvedValue(status);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>
        <BlockerBanner />
      </MantineProvider>
    </QueryClientProvider>,
  );
};

test("warns when the home box is offline", async () => {
  renderWith({ online: false, last_seen: "2026-10-21T12:00:00Z" });
  expect(await screen.findByText(/home box went quiet/)).toBeInTheDocument();
});

test("silent while the home box is online", async () => {
  renderWith({ online: true, last_seen: "2026-10-21T12:00:00Z" });
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByRole("alert")).toBeNull();
});
