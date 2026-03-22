export interface BotLifecycleScaffold {
  readonly stages: readonly ["boot", "listen", "shutdown"];
  readonly autoReconnect: true;
}

export function createLifecycleScaffold(): BotLifecycleScaffold {
  return {
    stages: ["boot", "listen", "shutdown"],
    autoReconnect: true
  };
}
