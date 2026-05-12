import { computeChatMessages } from "@/lib/use-chat-messages";

describe("computeChatMessages", () => {
  const baseSteps = [
    { sessionId: "s1", turnId: "t1", step: 1, thought: "thinking", toolCalls: null, duration_ms: 100, error: null, timestamp: 1000 },
    { sessionId: "s1", turnId: "t1", step: 2, thought: "more thinking", toolCalls: [{ tool: "search", error: null }], duration_ms: 200, error: null, timestamp: 2000 },
  ];

  const baseCompletions: Record<string, { sessionId: string; turnId?: string; content: string | null; usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null; completedAt: number }[]> = {
    "s1": [{ sessionId: "s1", turnId: "t1", content: "Hello world", usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, completedAt: 3000 }],
  };

  const baseUserMsgs = [
    { sessionId: "s1", input: "Hi", timestamp: 500, turnKey: "t1", turnId: "t1" },
  ];

  const baseHandoffs: { fromAgent: string; toAgent: string; timestamp: number }[] = [];

  it("returns empty array when no active session", () => {
    const result = computeChatMessages(null, baseSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result).toEqual([]);
  });

  it("returns user + assistant messages for active session", () => {
    const result = computeChatMessages("s1", baseSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result.length).toBe(2); // 1 user + 1 assistant
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("Hi");
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toBe("Hello world");
  });

  it("marks assistant message as not streaming when completion exists", () => {
    const result = computeChatMessages("s1", baseSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result[1].isStreaming).toBe(false);
  });

  it("marks assistant message as streaming when no completion", () => {
    const noCompletions: typeof baseCompletions = {};
    const result = computeChatMessages("s1", baseSteps, noCompletions, baseUserMsgs, baseHandoffs);
    expect(result[1].isStreaming).toBe(true);
    expect(result[1].content).toBe("");
  });

  it("includes steps in assistant message", () => {
    const result = computeChatMessages("s1", baseSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result[1].steps).toBeDefined();
    expect(result[1].steps!.length).toBe(2);
  });

  it("includes usage in completed assistant message", () => {
    const result = computeChatMessages("s1", baseSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result[1].usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
  });

  it("filters steps by session", () => {
    const multiSteps = [
      ...baseSteps,
      { sessionId: "s2", turnId: "t2", step: 1, thought: "other", toolCalls: null, duration_ms: 50, error: null, timestamp: 1500 },
    ];
    const result = computeChatMessages("s1", multiSteps, baseCompletions, baseUserMsgs, baseHandoffs);
    expect(result[1].steps!.length).toBe(2); // Only s1 steps
  });

  it("handles multiple turns", () => {
    const multiUserMsgs = [
      { sessionId: "s1", input: "Hi", timestamp: 500, turnKey: "t1", turnId: "t1" },
      { sessionId: "s1", input: "Follow up", timestamp: 4000, turnKey: "t2", turnId: "t2" },
    ];
    const multiCompletions: typeof baseCompletions = {
      "s1": [
        { sessionId: "s1", turnId: "t1", content: "Hello", usage: null, completedAt: 3000 },
        { sessionId: "s1", turnId: "t2", content: "Follow up reply", usage: null, completedAt: 5000 },
      ],
    };
    const result = computeChatMessages("s1", baseSteps, multiCompletions, multiUserMsgs, baseHandoffs);
    expect(result.length).toBe(4); // 2 user + 2 assistant
    expect(result[2].role).toBe("user");
    expect(result[2].content).toBe("Follow up");
    expect(result[3].content).toBe("Follow up reply");
  });
});
