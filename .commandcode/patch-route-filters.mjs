import fs from "node:fs";

const f = "src/components/map/MapCanvas.tsx";
let c = fs.readFileSync(f, "utf8");
const ids = [
  "route-halo-a",
  "route-halo-b",
  "route-line",
  "route-flow-tail",
  "route-flow-head",
  "route-arrows",
];
let n = 0;
for (const id of ids) {
  const re = new RegExp(
    `(id: '${id}',\\n        type: '[^']+',\\n        source: 'routes',\\n)(        layout:)`,
  );
  if (re.test(c)) {
    c = c.replace(re, `$1        filter: HIDE_ALL_ROUTES,\n$2`);
    n++;
  } else {
    console.log("NO MATCH", id);
  }
}
fs.writeFileSync(f, c);
console.log("patched", n);
