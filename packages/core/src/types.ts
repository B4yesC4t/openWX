export interface ScaffoldModule {
  readonly packageName: string;
  readonly status: "scaffolded";
  readonly notes: readonly string[];
}

export interface ConnectorRequest {
  readonly conversationId: string;
  readonly text: string;
  readonly media?: {
    readonly type: string;
    readonly filePath: string;
    readonly mimeType: string;
  };
}

export interface ConnectorResponse {
  readonly text?: string;
  readonly media?: {
    readonly type: string;
    readonly url: string;
    readonly fileName?: string;
  };
}

export interface Connector {
  readonly id: string;
  handle(request: ConnectorRequest): Promise<ConnectorResponse>;
}

export function createScaffoldModule(
  packageName: string,
  notes: readonly string[]
): ScaffoldModule {
  return {
    packageName,
    status: "scaffolded",
    notes
  };
}
