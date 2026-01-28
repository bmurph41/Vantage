const fs = require("fs");
const path = "/home/runner/workspace/client/src/components/doc-intel/PLReviewGrid.tsx";
let content = fs.readFileSync(path, "utf8");
const bt = String.fromCharCode(96);
let count = 0;
while (content.includes("fetch" + bt)) {
  content = content.replace("fetch" + bt, "fetch(" + bt);
  count++;
}
fs.writeFileSync(path, content);
console.log("Fixed", count, "fetch statements");
