export function formatEchoReply(text: string | undefined): string {
  return `Echo: ${text ?? "收到一条消息"}`;
}
