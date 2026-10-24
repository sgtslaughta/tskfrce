import { beforeEach, describe, expect, test } from "@jest/globals";
import type { Mock } from "jest-mock";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { api } from "@/v2/api";
import { ThreadView } from "@/v2/chat/ThreadView";
import { ThreadList } from "@/v2/chat/ThreadList";
import { KidCard } from "@/v2/today/KidCard";
import type { TodayKid } from "@/v2/types";
import * as mantineHooks from "@mantine/hooks";

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
    if (p.startsWith("/chat/threads/chore/3?before=")) return { ...page, kind: "chore", messages: [msg(1)], has_more: false };
    if (p.startsWith("/chat/threads/chore/")) return { ...page, kind: "chore", title: "Chore task" };
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

test("Today chat box shows the latest message across the kid's threads", async () => {
  threads = {
    total: 1,
    threads: [
      { id: 1, kind: "private", task_id: null, kid_id: 3, title: "Maya", unread: 0, last_message_at: "2020-01-01T10:00:00Z", last_author: "Maya", last_text: "older" },
      { id: 2, kind: "chore", task_id: 5, kid_id: null, title: "Dishes", unread: 1, last_message_at: "2020-01-02T10:00:00Z", last_author: "Maya", last_text: "all done" },
      { id: 3, kind: "chore", task_id: 99, kid_id: null, title: "Other kid", unread: 4, last_message_at: "2020-01-03T10:00:00Z", last_author: "Sam", last_text: "not hers" },
    ],
  };
  const kid = { id: 3, name: "Maya", chores: [{ id: 5, title: "Dishes" }], devices: [], progress: undefined } as unknown as TodayKid;
  wrap(<KidCard kid={kid} />);
  expect(await screen.findByText(/all done/)).toBeInTheDocument();
  expect(screen.getByText(/in Dishes/)).toBeInTheDocument();
  expect(screen.getByText(/1 new/)).toBeInTheDocument();
  expect(screen.queryByText(/not hers/)).toBeNull();
  expect(screen.getByRole("button", { name: "Open chat" })).toBeInTheDocument();
});

test("Today chat box invites you to say hi when nothing was said", async () => {
  const kid = { id: 3, name: "Maya", chores: [], devices: [], progress: undefined } as unknown as TodayKid;
  wrap(<KidCard kid={kid} />);
  expect(await screen.findByText("Nothing yet. Say hi to Maya.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Say hi to Maya" })).toBeInTheDocument();
});

describe("Chat page (parent restyle)", () => {
  test("search filters threads", async () => {
    const sampleThreads = [
      { id: 1, kind: "private" as const, task_id: null, kid_id: 3, title: "Maya chat", unread: 0, last_message_at: "2020-01-01T10:00:00Z", last_author: "Maya", last_text: "hello" },
      { id: 2, kind: "chore" as const, task_id: 5, kid_id: null, title: "Dishes", unread: 0, last_message_at: "2020-01-02T10:00:00Z", last_author: "Maya", last_text: "looks good" },
      { id: 3, kind: "family" as const, task_id: null, kid_id: null, title: "Family", unread: 0, last_message_at: "2020-01-03T10:00:00Z", last_author: "Sam", last_text: "family chat" },
    ];
    render(
      <MantineProvider>
        <ThreadList threads={sampleThreads} selected={null} onPick={() => {}} />
      </MantineProvider>,
    );
    const searchBox = screen.getByLabelText("Search threads") as HTMLInputElement;

    // Verify all threads are visible initially
    expect(screen.getByText("Maya chat")).toBeInTheDocument();
    expect(screen.getByText("Dishes")).toBeInTheDocument();
    expect(screen.getAllByText("Family")[0]).toBeInTheDocument();

    // Search by title
    await userEvent.type(searchBox, "Dishes");
    expect(screen.getByText("Dishes")).toBeInTheDocument();
    expect(screen.queryByText("Maya chat")).toBeNull();
    // Check that Family thread is not in the conversation list (tab might still show "Family")
    const conversationList = screen.getByLabelText("Conversations");
    expect(conversationList.textContent).not.toContain("family chat");

    // Clear and search by last_text
    await userEvent.clear(searchBox);
    await userEvent.type(searchBox, "family chat");
    expect(screen.getAllByText("Family")[0]).toBeInTheDocument();
    expect(screen.queryByText("Dishes")).toBeNull();
  });

  test("chore thread header shows approve when needs OK", async () => {
    page.messages = [msg(1)];
    page.kind = "chore";
    wrap(<ThreadView kind="chore" refId="3" meId={1} />);

    // Wait for Approve button to appear
    const approveButton = await screen.findByRole("button", { name: /Approve/i });
    expect(approveButton).toBeInTheDocument();

    // Check for Send back button
    const sendBackButton = screen.getByRole("button", { name: /Send back/i });
    expect(sendBackButton).toBeInTheDocument();
  });

  test("side panel hidden below 1250px", async () => {
    // Mock useMediaQuery to return false for wide layout
    jest.spyOn(mantineHooks, "useMediaQuery").mockReturnValue(false);

    page.messages = [msg(1)];
    wrap(<ThreadView kind="chore" refId="3" meId={1} />);

    // Wait for component to render
    await waitFor(() => expect(screen.getByTestId("msg-other")).toBeInTheDocument());

    // Check that side panel is not rendered
    const sidePanelHeading = screen.queryByText("Steps");
    expect(sidePanelHeading).toBeNull();

    jest.restoreAllMocks();
  });

  test("day separator renders", async () => {
    page.messages = [msg(1)];
    view();
    expect(await screen.findByTestId("day-sep")).toBeInTheDocument();
  });
});
