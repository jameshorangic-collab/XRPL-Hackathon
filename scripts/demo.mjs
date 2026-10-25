import { spawn } from "node:child_process";
const children = [];
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
const chain = spawn(
  process.execPath,
  [
    "node_modules/hardhat/internal/cli/cli.js",
    "node",
    "--hostname",
    "127.0.0.1",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
children.push(chain);
chain.stdout.on("data", (data) => {
  if (data.toString().includes("Started HTTP"))
    console.log(
      "[BACKSTOP] Local EVM ready at http://127.0.0.1:8545 (chain 31337).",
    );
});
chain.stderr.on("data", (data) => {
  if (data.toString().includes("EADDRINUSE"))
    console.error(
      "[BACKSTOP] Port 8545 is occupied. Stop the existing chain before starting this combined demo.",
    );
});
const app = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"],
  { stdio: "inherit" },
);
children.push(app);
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!stopping) shutdown(code || 0);
  });
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
console.log(
  "[BACKSTOP] Starting a synthetic portfolio demo. No credentials required. Ctrl+C stops both services.",
);
