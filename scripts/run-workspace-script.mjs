import { spawnSync } from "node:child_process";

const [scriptName, ...extraArgs] = process.argv.slice(2);

if (!scriptName) {
  console.error("workspace script name is required");
  process.exit(1);
}

const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = ["-r", "--if-present"];

if (extraArgs.includes("--parallel")) {
  args.push("--parallel");
}

for (let index = 0; index < extraArgs.length; index += 1) {
  const arg = extraArgs[index];

  if (arg === "--parallel") {
    continue;
  }

  if (arg === "--filter") {
    const filterValue = extraArgs[index + 1];
    if (!filterValue) {
      console.error("--filter requires a value");
      process.exit(1);
    }
    args.push("--filter", filterValue);
    index += 1;
    continue;
  }

  args.push(arg);
}

args.push(scriptName);

const result = spawnSync(pnpmExecutable, args, {
  stdio: "inherit",
  cwd: process.cwd()
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
