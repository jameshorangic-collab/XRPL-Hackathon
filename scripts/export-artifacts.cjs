const fs = require("node:fs");
for (const name of ["MockUSD", "BackstopFacility"]) {
  const artifact = JSON.parse(
    fs.readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, "utf8"),
  );
  fs.writeFileSync(
    `public/contracts/${name}.json`,
    JSON.stringify({ abi: artifact.abi, bytecode: artifact.bytecode }),
  );
}
