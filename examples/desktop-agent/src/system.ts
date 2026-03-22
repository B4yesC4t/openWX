import { exec, execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export async function listDirectory(targetPath: string): Promise<string> {
  const { stdout } = await execFileAsync("ls", ["-la", targetPath]);
  return stdout.trim();
}

export async function runShellCommand(command: string, cwd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(command, {
    cwd,
    shell: "/bin/bash"
  });

  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
}

export async function captureScreenshot(): Promise<string> {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "openwx-desktop-agent-"));
  const outputPath = path.join(outputDirectory, "desktop.png");

  if (process.platform === "darwin") {
    await execFileAsync("screencapture", ["-x", outputPath]);
    return outputPath;
  }

  if (process.platform === "linux") {
    await execFileAsync("import", ["-window", "root", outputPath]);
    return outputPath;
  }

  throw new Error("Screenshot capture is only implemented for macOS and Linux.");
}
