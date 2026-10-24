import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import type { Mock } from "jest-mock";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { api } from "@/v2/api";
import { ThreadView } from "@/v2/chat/ThreadView";
import { GifsCard } from "@/v2/manage/FamilyCards";
import type { Family } from "@/v2/types";

jest.mock("@/v2/api", () => ({ api: jest.fn() }));
jest.mock("@mantine/notifications", () => ({ notifications: { show: jest.fn() } }));
jest.mock("@/v2/today/PhotoViewer", () => ({ useAuthImage: (p: string | null) => (p ? "blob:x" : null) }));

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>;
const page = { id: 9, kind: "private", title: "Maya", messages: [], has_more: false };
let gifsOn: boolean;

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  );

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  gifsOn = true;
  apiMock.mockReset();
  apiMock.mockImplementation(async (p, init) => {
    if (p === "/chat/threads") return { total: 0, threads: [], gifs_enabled: gifsOn };
    if (p.startsWith("/chat/gifs")) return [{ id: "abc", width: 100, height: 80, preview_url: "/chat/gifs/abc/preview" }];
    if (p.endsWith("/gifs")) return { photo_id: 5 };
    if (p.startsWith("/chat/threads/private/")) return page;
    if (p.endsWith("/messages")) return { id: 1 };
    if (init?.method === "POST") return { ok: true };
    return undefined;
  });
});

describe("GIFs in chat", () => {
  test("GIF button is hidden when GIFs are off", async () => {
    gifsOn = false;
    wrap(<ThreadView kind="private" refId="3" meId={1} />);
    await screen.findByLabelText("Message");
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/chat/threads", expect.anything()));
    expect(screen.queryByRole("button", { name: "Add GIF" })).toBeNull();
  });

  test("picker shows results and credit; picking saves then posts", async () => {
    wrap(<ThreadView kind="private" refId="3" meId={1} kid />);
    await userEvent.click(await screen.findByRole("button", { name: "Add GIF" }));
    expect(await screen.findByText("Powered by GIPHY")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search GIFs"), "cat");
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/chat/gifs?q=cat", expect.anything()), { timeout: 2000 });
    expect(await screen.findByAltText("GIF")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send this GIF" }));
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/chat/threads/9/gifs", expect.objectContaining({ body: { gif_id: "abc" } })),
    );
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/chat/threads/9/messages",
        expect.objectContaining({ body: { body: null, photo_id: 5 } }),
      ),
    );
  });

  test("settings card never shows the key and Save waits for a change", async () => {
    const fam = {
      name: "S", timezone: "UTC", reset_time: "06:00", new_devices_blocked: true, points_unlock_early: false,
      early_bonus_cap: 5, screen_time_price: 20, gifs_enabled: false, gif_rating: "g", giphy_key_set: true,
    } as Family;
    wrap(<GifsCard fam={fam} />);
    const key = screen.getByLabelText("GIPHY key");
    expect(key).toHaveValue("");
    expect(key).toHaveAttribute("placeholder", "Saved");
    const save = screen.getByRole("button", { name: "Save settings" });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Allow GIFs in chat"));
    expect(save).toBeEnabled();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://developers.giphy.com/dashboard/");
  });
});
