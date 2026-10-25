import { createServer } from "node:http";
import { configuration } from "./config";
import { createBackend } from "./app";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const config = configuration();
const app = createBackend(config);
const root = resolve("dist");
const server = createServer((req, res) => {
  if ((req.url ?? "/").startsWith("/api/")) {
    void app.handler(req, res);
    return;
  }
  void (async () => {
    try {
      const url = new URL(req.url ?? "/", config.appOrigin);
      let path = decodeURIComponent(url.pathname);
      if (
        ["/", "/signup", "/borrow", "/invest", "/dashboard"].includes(
          path.replace(/\/$/, "") || "/",
        )
      )
        path = "/index.html";
      const file = resolve(root, "." + path);
      if (!file.startsWith(root + "/")) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      const contentTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, {
        "Content-Type":
          contentTypes[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Build first with npm run build, then open /signup.");
    }
  })();
});
server.listen(config.port, "127.0.0.1", () =>
  console.log(
    `BACKSTOP API http://127.0.0.1:${config.port} (synthetic business data; secrets withheld)`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    server.close(() => {
      app.close();
      process.exit(0);
    }),
  );
