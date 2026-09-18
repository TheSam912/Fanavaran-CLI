#!/usr/bin/env node
"use strict";

const { main } = require("../src/index");

main(process.argv.slice(2)).catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  console.error(msg);
  process.exit(1);
});
