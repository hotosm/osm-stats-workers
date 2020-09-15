#!/usr/bin/env node

const adiff = require("../src/adiff");

process.on("unhandledRejection", err => {
  throw err;
});

adiff({
  infinite: true
});
