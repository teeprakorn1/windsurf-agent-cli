import { useDashboardStore } from "@/lib/store";

// Mock WebSocket
class MockWS {
  readyState = 1; // OPEN
  sent: string[] = [];
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; }
}

let mockWs: MockWS;

beforeEach(() => {
  mockWs = new MockWS();
  useDashboardStore.setState({
    connected: true,
    activities: {},
    streamingMap: {},
    agentStatuses: {},
    notifications: [],
    handoffs: [],
    delegates: [],
    errors: [],
    historyLoaded: false,
  });
});

// --- Store state tests ---

describe("useDashboardStore", () => {
  it("has correct default values after reset", () => {
    const state = useDashboardStore.getState();
    expect(state.activities).toEqual({});
    expect(state.streamingMap).toEqual({});
    expect(state.errors).toEqual([]);
    expect(state.notifications).toEqual([]);
    expect(state.handoffs).toEqual([]);
    expect(state.delegates).toEqual([]);
  });

  it("sendRun validates input", () => {
    const ws = useDashboardStore.getState();
    // Empty input should push error
    ws.sendRun({ input: "" });
    const errors = useDashboardStore.getState().errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Task input");
  });

  it("sendRun validates provider", () => {
    const ws = useDashboardStore.getState();
    ws.sendRun({ input: "hello", provider: "invalid_provider" });
    const errors = useDashboardStore.getState().errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Invalid provider");
  });

  it("sendRun validates maxSteps range", () => {
    const ws = useDashboardStore.getState();
    ws.sendRun({ input: "test", maxSteps: 0 });
    expect(useDashboardStore.getState().errors[0].message).toContain("maxSteps");

    useDashboardStore.setState({ errors: [] });
    ws.sendRun({ input: "test", maxSteps: 999 });
    expect(useDashboardStore.getState().errors[0].message).toContain("maxSteps");
  });

  it("addChatUserMsg adds message to activity", () => {
    useDashboardStore.setState({
      activities: {
        "sess-1": {
          id: "sess-1", mode: "chat", agentName: "test", provider: "mock", model: "gpt",
          status: "idle", steps: [], completions: [], userMessages: [],
          streamingContent: "", isStreaming: false, createdAt: Date.now(),
          completedAt: null, usage: null,
        },
      },
    });

    const ws = useDashboardStore.getState();
    ws.addChatUserMsg("sess-1", { input: "hello", timestamp: Date.now(), turnKey: "t1", turnId: "t1" });

    const activity = useDashboardStore.getState().activities["sess-1"];
    expect(activity.userMessages.length).toBe(1);
    expect(activity.userMessages[0].input).toBe("hello");
  });

  it("addChatUserMsg ignores non-existent session", () => {
    const before = useDashboardStore.getState().activities;
    const ws = useDashboardStore.getState();
    ws.addChatUserMsg("nonexistent", { input: "hello", timestamp: Date.now(), turnKey: "t1", turnId: "t1" });
    expect(useDashboardStore.getState().activities).toBe(before);
  });

  it("deleteChatSession removes activity", () => {
    useDashboardStore.setState({
      activities: {
        "sess-1": {
          id: "sess-1", mode: "chat", agentName: "test", provider: "mock", model: "gpt",
          status: "idle", steps: [], completions: [], userMessages: [],
          streamingContent: "", isStreaming: false, createdAt: Date.now(),
          completedAt: null, usage: null,
        },
        "sess-2": {
          id: "sess-2", mode: "chat", agentName: "test2", provider: "mock", model: "gpt",
          status: "idle", steps: [], completions: [], userMessages: [],
          streamingContent: "", isStreaming: false, createdAt: Date.now(),
          completedAt: null, usage: null,
        },
      },
    });

    const ws = useDashboardStore.getState();
    ws.deleteChatSession("sess-1");

    const activities = useDashboardStore.getState().activities;
    expect(Object.keys(activities)).toEqual(["sess-2"]);
  });

  it("clearChatHistory clears activities", () => {
    useDashboardStore.setState({
      activities: {
        "sess-1": {
          id: "sess-1", mode: "chat", agentName: "test", provider: "mock", model: "gpt",
          status: "idle", steps: [], completions: [], userMessages: [],
          streamingContent: "", isStreaming: false, createdAt: Date.now(),
          completedAt: null, usage: null,
        },
      },
    });

    const ws = useDashboardStore.getState();
    ws.clearChatHistory();

    expect(useDashboardStore.getState().activities).toEqual({});
  });

  it("dismissNotification marks notification as dismissed", () => {
    useDashboardStore.setState({
      notifications: [
        { id: "n1", type: "success", title: "Test", message: "msg", timestamp: Date.now(), dismissed: false },
      ],
    });

    const ws = useDashboardStore.getState();
    ws.dismissNotification("n1");

    expect(useDashboardStore.getState().notifications[0].dismissed).toBe(true);
  });

  it("clearErrors resets errors array", () => {
    useDashboardStore.setState({ errors: [{ message: "err", time: Date.now() }] });

    const ws = useDashboardStore.getState();
    ws.clearErrors();

    expect(useDashboardStore.getState().errors).toEqual([]);
  });
});
