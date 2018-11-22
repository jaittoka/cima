const typeRE = /^\[object ([^\]]+)\]$/;

function getType(v) {
  return typeRE.exec(Object.prototype.toString.call(v))[1];
}

module.exports = getType;
