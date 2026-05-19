const generic = require("./generic-adapter");

function buildEngine(engine) {
  return {
    ...engine,
    args: engine.args || ["--print", "{prompt}"],
  };
}

function call(engine, messages, options = {}) {
  return generic.callCliEngine(buildEngine(engine), messages, options);
}

module.exports = { call, buildEngine };
