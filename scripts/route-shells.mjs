import { readFile, mkdir, writeFile } from "node:fs/promises";
// Physical route shells preserve refresh/deep links on the existing static Drop deployment.
const html = await readFile("dist/index.html", "utf8");
for (const route of ["signup", "borrow", "invest", "dashboard"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await writeFile(`dist/${route}/index.html`, html);
}
