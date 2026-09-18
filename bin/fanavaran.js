#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "index.js");
if (!fs.existsSync(src)) {
  console.error("Fanavaran CLI source is missing next to this file.");
  console.error("From the Fanavaran-CLI repo run:");
  console.error("  node bin/fanavaran.js setup");
  process.exit(1);
}

const { main } = require("../src/index");

main(process.argv.slice(2)).catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(1);
});
