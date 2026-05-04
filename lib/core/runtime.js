/**
 * Runtime detection — Node.js or Bun
 */

const isBun = typeof Bun !== "undefined";
const runtime = isBun ? "bun" : "node";

module.exports = {
  runtime,
  isBun,
};
