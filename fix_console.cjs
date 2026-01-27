const fs = require("fs");
const path = process.argv[2];
let content = fs.readFileSync(path, "utf8");
const bt = String.fromCharCode(96);
let count = 0;
while (content.includes("console.log" + bt)) {
  content = content.replace("console.log" + bt, "console.log(" + bt);
  count++;
}
while (content.includes("console.error" + bt)) {
  content = content.replace("console.error" + bt, "console.error(" + bt);
  count++;
}
fs.writeFileSync(path, content);
console.log("Fixed", count, "statements");
