import { beforeEach, describe, expect, test } from "@jest/globals";
import type { Mock } from "jest-mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { fridgeTheme } from "@/v2/theme";
import { api } from "@/v2/api";
import { TodayPage } from "@/v2/today/TodayPage";
import { DeviceQuickMenu } from "@/v2/today/DeviceQuickMenu";
import { DevicePill } from "@/v2/components/DevicePill";
import type { Today, TodayChore } from "@/v2/types";

jest.mock("@/v2/api", () => ({ api: jest.fn() }));
jest.mock("@mantine/notifications", () => ({
  notifications: { show: jest.fn() },
}));
jest.mock("@/v2/components/FridgeShell", () => ({
  FridgeShell: ({
    title,
    actions,
    children,
  }: {
    title: string;
    actions?: unknown;
    children: unknown;
  }) => (
    <div>
      <h1>{title as string}</h1>
      {actions as never}
      {children as never}
    </div>
  ),
}));

const apiMock = api as unknown as Mock<
  (p: string, init?: unknown) => Promise<unknown>
>;

const chore = (id: number, state: TodayChore["state"]): TodayChore => ({
  id,
  title: `Chore ${id}`,
  points: 5,
  state,
});
const base: Today = {
  day: "2026-10-20",
  pending_approvals: 2,
  new_devices: [],
  needs_you: [
    { type: "chore", id: 12, kid_id: 1, kid_name: "Emma", title: "Clean room", attempt: 1, thumb_url: "/chore-photos/5/thumb", subtasks_done: 3, subtasks_total: 3, submitted_at: "2026-10-20T16:12:00Z" },
    { type: "redo", id: 13, kid_id: 2, kid_name: "Leo", title: "Make bed", attempt: 2, thumb_url: null, submitted_at: "2026-10-20T16:40:00Z" },
    { type: "screen_time", id: 7, kid_id: 2, kid_name: "Leo", title: "30 min", cost: 40, kid_balance: 95, submitted_at: "2026-10-20T17:00:00Z" },
    { type: "reward", id: 8, kid_id: 1, kid_name: "Emma", title: "Movie night", cost: 300, kid_balance: 610, submitted_at: "2026-10-20T17:10:00Z" },
  ],
  kids: [
    {
      id: 1,
      name: "Emma",
      avatar: null,
      online_all: false,
      done: 3,
      total: 7,
      needs_you_count: 1,
      chores: [chore(11, "done"), chore(12, "needs_you")],
      devices: [{ id: 21, name: "iPad", vendor: "Apple", online: false }],
    },
    {
      id: 2,
      name: "Leo",
      avatar: null,
      online_all: true,
      done: 0,
      total: 1,
      needs_you_count: 0,
      chores: [chore(31, "todo")],
      devices: [],
    },
  ],
};

let client: QueryClient;
function renderPage(data: Today) {
  apiMock.mockImplementation(async (p) =>
    p === "/today"
      ? data
      : p === "/profiles"
        ? []
        : p === "/leaderboard"
          ? { week_start: "2026-01-05", rows: [] }
          : { ok: true },
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={fridgeTheme}>
        <TodayPage />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiMock.mockReset();
  localStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: false })) as never;
});

describe("TodayPage", () => {
  test("renders kids, day name and sticker", async () => {
    renderPage(base);
    expect(await screen.findByRole("tab", { name: /Emma/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Leo/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Tuesday" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 chores need you")).toBeInTheDocument();
  });

  test("shows new device banner", async () => {
    renderPage({ ...base, new_devices: [{ id: 9, name: "Xbox" } as never] });
    const link = await screen.findByRole("link", { name: /Assign it/ });
    expect(link).toHaveAttribute("href", "/devices?focus=9");
    expect(screen.getByText(/New device joined: Xbox/)).toBeInTheDocument();
  });

  test("many new devices collapse into one banner", async () => {
    const d = (id: number, name: string) => ({ id, name }) as never;
    renderPage({ ...base, new_devices: [d(1, "pixel.lan"), d(2, "xbox.lan"), d(3, "tv.lan")] });
    expect(await screen.findByText(/3 new devices joined: pixel, xbox and 1 more/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Assign them/ })).toHaveLength(1);
  });

  test("Needs you shows one item per type with chip label and icon", async () => {
    renderPage(base);
    await screen.findByText("Needs you · 4");
    for (const t of ["chore", "redo", "screen_time", "reward"])
      expect(screen.getAllByTestId(`type-${t}`).length).toBeGreaterThan(0);
    expect(screen.getByText("Redo")).toBeInTheDocument();
    expect(screen.getByText("Reward")).toBeInTheDocument();
    expect(screen.getByText(/2nd try/)).toBeInTheDocument();
  });

  test("filter chip shows only that type", async () => {
    renderPage(base);
    await userEvent.click(await screen.findByRole("button", { name: "Screen time 1" }));
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Clean room/)).toBeNull();
  });

  test("Approve on a chore posts and invalidates today", async () => {
    renderPage(base);
    const spy = jest.spyOn(client, "invalidateQueries");
    await screen.findByText("Needs you · 4");
    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/chores/12/approve", { method: "POST" }),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["today"] }));
  });

  test("Send back needs a note", async () => {
    renderPage(base);
    await screen.findByText("Needs you · 4");
    await userEvent.click(screen.getAllByRole("button", { name: "Send back" })[0]);
    expect(screen.getAllByRole("button", { name: "Send back" })[0]).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Note"), "Under the bed too");
    await userEvent.click(screen.getAllByRole("button", { name: "Send back" })[0]);
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/chores/12/send-back", {
        method: "POST",
        body: { note: "Under the bed too" },
      }),
    );
  });

  test("tapping a thumbnail opens the viewer", async () => {
    renderPage(base);
    await userEvent.click(await screen.findByRole("button", { name: "Open photo for Clean room" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Note for sending back")).toBeInTheDocument();
  });

  test("Approve all approves every visible item", async () => {
    renderPage(base);
    await userEvent.click(await screen.findByRole("button", { name: "Approve all" }));
    await waitFor(() => {
      const paths = apiMock.mock.calls.map(([p]) => p);
      expect(paths).toEqual(
        expect.arrayContaining([
          "/chores/12/approve",
          "/chores/13/approve",
          "/redemptions/7/approve",
          "/redemptions/8/approve",
        ]),
      );
    });
  });

  test("kid tabs show done/total and a dot; only the open tab renders chores", async () => {
    renderPage(base);
    const tab = await screen.findByRole("tab", { name: /Emma 3\/7/ });
    expect(within(tab).getByTestId("dot-1")).toBeInTheDocument();
    expect(screen.queryByTestId("dot-2")).toBeNull();
    expect(screen.getByText("Chore 12")).toBeInTheDocument();
    expect(screen.queryByText("Chore 31")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /Leo/ }));
    expect(await screen.findByText("Chore 31")).toBeInTheDocument();
    expect(screen.queryByText("Chore 12")).toBeNull();
  });

  test("Done is collapsed by default", async () => {
    renderPage(base);
    await screen.findByText("Chore 12");
    expect(screen.getByText("Done · 1").closest("details")).not.toHaveAttribute("open");
  });

  test("device menu Unlock for 1 hour posts override", async () => {
    renderPage(base);
    const spy = jest.spyOn(client, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: /iPad/ }));
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Unlock for 1 hour",
        hidden: true,
      }),
    );
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/devices/21/override", {
        method: "POST",
        body: { action: "unlock", minutes: 60 },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["devices"] }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["today"] });
  });

  test("kid badge menu uses kid override and Back to schedule deletes", async () => {
    renderPage(base);
    await userEvent.click(
      await screen.findByLabelText("Lock or unlock all of Emma’s devices"),
    );
    // hidden: true because jsdom has no layout: floating-ui sees a zero-size reference and hides the dropdown
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: "Back to schedule",
        hidden: true,
      }),
    );
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith("/kids/1/override", {
        method: "DELETE",
      }),
    );
  });

  test("DeviceQuickMenu forwards trigger props and ref to a DevicePill", async () => {
    apiMock.mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider theme={fridgeTheme}>
          <DeviceQuickMenu
            targets={{ kind: "group", id: 3 }}
            label="Xbox options"
          >
            <DevicePill name="Xbox" kind="console" online />
          </DeviceQuickMenu>
        </MantineProvider>
      </QueryClientProvider>,
    );
    const btn = screen.getByRole("button", { name: /Xbox/ });
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  test("empty state", async () => {
    renderPage({ ...base, pending_approvals: 0, needs_you: [], kids: [] });
    expect(
      await screen.findByText("Add your first kid to get started."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /kid/i })).toHaveAttribute(
      "href",
      "/kids",
    );
  });
});
