import { beforeEach, describe, expect, test } from "@jest/globals";
import type { Mock } from "jest-mock";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { api } from "@/v2/api";
import { ThreadView } from "@/v2/chat/ThreadView";
import { FridgeShell } from "@/v2/components/FridgeShell";
import { KidCard } from "@/v2/today/KidCard";
import type { TodayKid } from "@/v2/types";

jest.mock("@/v2/api", () => ({ api: jest.fn() }));
jest.mock("@mantine/notifications", () => ({ notifications: { show: jest.fn() } }));
jest.mock("next/router", () => ({ useRouter: () => ({ pathname: "/", query: {}, replace: jest.fn() }) }));
jest.mock("@/contexts/UnifiedAuthContext", () => ({ useUnifiedAuth: () => ({ logout: jest.fn(), user: { id: 1 } }) }));

const apiMock = api as unknown as Mock<(p: string, init?: { method?: string; body?: unknown }) => Promise<unknown>>;

const msg = (id: number, over: object = {}) => ({
  id, author_id: 2, author_name: "Maya", kind: "user", body: `m${id}`, photo_url: null,
  created_at: "2026-10-21T15:00:00Z", ...over,
});
let page: { id: number; kind: string; title: string; messages: object[]; has_more: boolean };
let threads: { total: number; threads: object[] };

beforeEach(() => {
  apiMock.mockReset();
  page = { id: 9, kind: "private", title: "Maya", messages: [], has_more: false };
  threads = { total: 0, threads: [] };
  apiMock.mockImplementation(async (p, init) => {
    if (p === "/chat/threads") return threads;
    if (p.startsWith("/chat/threads/private/3?before=")) return { ...page, messages: [msg(1)], has_more: false };
    if (p.startsWith("/chat/threads/private/")) return page;
    if (p.endsWith("/messages")) return msg(99, { author_id: 1 });
    if (init?.method === "POST") return { ok: true };
    return undefined;
  });
});

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  );
const view = () => wrap(<ThreadView kind="private" refId="3" meId={1} />);
const posts = () => apiMock.mock.calls.filter(([p]) => p.endsWith("/messages"));

describe("ThreadView", () => {
  test("own, other and system messages look different", async () => {
    page.messages = [msg(1), msg(2, { author_id: 1, body: "mine" }), msg(3, { author_id: null, kind: "system", body: "Photo added" })];
    view();
    expect(await screen.findByText("mine")).toBeInTheDocument();
    expect(screen.getByTestId("msg-mine")).toHaveTextContent("mine");
    expect(screen.getByTestId("msg-other")).toHaveTextContent("m1");
    expect(screen.getByTestId("msg-system")).toHaveTextContent("Photo added");
    expect(screen.getAllByTestId("day-sep")).toHaveLength(1);
  });

  test("Enter sends, Shift+Enter does not, empty cannot send", async () => {
    page.messages = [msg(1)];
    view();
    const box = await screen.findByLabelText("Message");
    const send = screen.getByRole("button", { name: "Send" });
    await waitFor(() => expect(send).toBeDisabled());
    await userEvent.type(box, "hi{Shift>}{Enter}{/Shift}there");
    expect(posts()).toHaveLength(0);
    expect(box).toHaveValue("hi\nthere");
    await userEvent.type(box, "{Enter}");
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0][1]?.body).toEqual({ body: "hi\nthere", photo_id: null });
    await userEvent.type(box, "{Enter}");
    expect(posts()).toHaveLength(1);
  });

  test("Load earlier asks for ?before=<oldest id>", async () => {
    page.messages = [msg(7), msg(8)];
    page.has_more = true;
    view();
    await userEvent.click(await screen.findByRole("button", { name: "Load earlier" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/chat/threads/private/3?before=7", expect.anything()));
    expect(await screen.findByText("m1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load earlier" })).toBeNull();
  });

  test("opening marks the thread read", async () => {
    page.messages = [msg(1)];
    view();
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/chat/threads/9/read", expect.objectContaining({ method: "POST" })),
    );
  });
});

test("Today chat box shows the last 2 messages", async () => {
  page.messages = [msg(1), msg(2), msg(3)];
  const kid = { id: 3, name: "Maya", chores: [], devices: [], progress: undefined } as unknown as TodayKid;
  wrap(<KidCard kid={kid} />);
  expect(await screen.findByText(/m3/)).toBeInTheDocument();
  expect(screen.getByText(/m2/)).toBeInTheDocument();
  expect(screen.queryByText(/m1/)).toBeNull();
  expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
});
