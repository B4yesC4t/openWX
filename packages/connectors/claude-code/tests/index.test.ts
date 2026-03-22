import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageContext } from "@openwx/bot";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

describe("createHandler", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls Claude Code via bash, passes model, and stores conversation history", async () => {
    const prompts: string[] = [];
    spawnMock
      .mockImplementationOnce(() => createSuccessfulChild("## 第一轮\n- **回复**", prompts))
      .mockImplementationOnce(() => createSuccessfulChild("第二轮回复", prompts));

    const { createHandler } = await import("../src/index.js");
    const handler = createHandler({
      cliPath: "/custom/claude",
      model: "claude-sonnet",
      systemPrompt: "请始终使用纯文本"
    });

    await expect(handler(createContext({ userId: "user-a", text: "你好" }))).resolves.toBe(
      "第一轮\n回复"
    );
    await expect(handler(createContext({ userId: "user-a", text: "继续" }))).resolves.toBe(
      "第二轮回复"
    );

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "/bin/bash",
      [
        "-lc",
        "unset CLAUDECODE; '/custom/claude' -p --output-format text --model 'claude-sonnet'"
      ],
      {
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
    expect(prompts[0]).toContain("请始终使用纯文本");
    expect(prompts[0]).toContain("用户: 你好");
    expect(prompts[1]).toContain("用户: 你好");
    expect(prompts[1]).toContain("助手: 第一轮\n回复");
    expect(prompts[1]).toContain("用户: 继续");
  });

  it("returns fallback text when the subprocess times out", async () => {
    vi.useFakeTimers();
    const child = createPendingChild();
    spawnMock.mockReturnValue(child);

    const { FALLBACK_TEXT, createHandler } = await import("../src/index.js");
    const handler = createHandler({
      cliPath: "/custom/claude",
      timeout: 10
    });

    const responsePromise = handler(createContext({ text: "timeout" }));
    await vi.advanceTimersByTimeAsync(10);

    await expect(responsePromise).resolves.toBe(FALLBACK_TEXT);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("returns fallback text when spawn errors", async () => {
    const child = createPendingChild();
    spawnMock.mockReturnValue(child);

    const { FALLBACK_TEXT, createHandler } = await import("../src/index.js");
    const responsePromise = createHandler({ cliPath: "/custom/claude" })(
      createContext({ text: "hello" })
    );
    child.emit("error", new Error("spawn failed"));

    await expect(responsePromise).resolves.toBe(FALLBACK_TEXT);
  });
});

function createContext(overrides: Partial<MessageContext>): MessageContext {
  return {
    message: { from_user_id: "user-1@im.wechat" },
    userId: "user-1@im.wechat",
    client: {} as never,
    reply: vi.fn(async () => undefined),
    replyImage: vi.fn(async () => undefined),
    replyFile: vi.fn(async () => undefined),
    text: "",
    ...overrides
  } as MessageContext;
}

function createSuccessfulChild(output: string, prompts: string[]) {
  const child = createPendingChild();
  child.stdin.end.mockImplementation((input?: string) => {
    prompts.push(String(input ?? ""));
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from(output));
      child.emit("close", 0);
    });
  });
  return child;
}

function createPendingChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: { end: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };

  child.stdin = {
    end: vi.fn()
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}
