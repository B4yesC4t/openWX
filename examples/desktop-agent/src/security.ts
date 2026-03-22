import path from "node:path";

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bpoweroff\b/,
  /\bhalt\b/,
  /\bmkfs\b/,
  /\bdd\b/
];

export function parseAllowedUsers(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

export function assertHasAllowedUsers(allowedUsers: ReadonlySet<string>): void {
  if (allowedUsers.size === 0) {
    throw new Error("OPENWX_ALLOWED_USERS is required for the desktop agent example.");
  }
}

export function isAllowedUser(userId: string, allowedUsers: ReadonlySet<string>): boolean {
  return allowedUsers.has(userId);
}

export function requiresConfirmation(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

export function resolveListPath(agentRoot: string, requestedPath: string | undefined): string {
  const root = path.resolve(agentRoot);
  const target = path.resolve(root, requestedPath ?? ".");

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Requested path escapes OPENWX_AGENT_ROOT.");
  }

  return target;
}
