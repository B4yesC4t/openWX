import { fileURLToPath } from "node:url";

export function exampleAssetPath(relativePath: string): string {
  return fileURLToPath(new URL(`../assets/${relativePath}`, import.meta.url));
}
