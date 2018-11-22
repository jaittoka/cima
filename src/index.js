const getType = require("./getType");

const T_UNDEFINED = "Undefined";
const T_NULL = "Null";
const T_BOOLEAN = "Boolean";
const T_NUMBER = "Number";
const T_STRING = "String";
const T_ARRAY = "Array";
const T_OBJECT = "Object";
const T_REGEXP = "RegExp";
const T_DATE = "Date";
const T_FUNCTION = "Function";

const DEFAULT_FIELD = "defaultValue";
const ARRAY_SUB_TYPE_FIELD = "subType";
const MULTI_SUB_TYPES_FIELD = "subTypes";
const ENUM_VALUES_FIELD = "values";
const OBJECT_FIELDS_FIELD = "fields";
const TYPE_FIELD = "$type";

class Path {
  constructor(parent, obj, name) {
    this.parent = parent;
    this.obj = obj;
    this.name = name;
  }

  toString() {
    function traverse(path, result = []) {
      if (!path) return "";
      result.push(path.name);
      traverse(path.parent, result);
      return result;
    }
    return traverse(this)
      .reverse()
      .join(".");
  }
}

const ROOT = new Path(null, {}, "");

function dropType(obj) {
  return Object.keys(obj)
    .filter(key => key !== TYPE_FIELD)
    .reduce((res, key) => {
      res[key] = obj[key];
      return res;
    }, {});
}

function error(path, msg) {
  const pathStr = path.toString();
  const e = new Error(pathStr + ": " + msg);
  e.path = pathStr;
  throw e;
}

function expectType(expected, value, path) {
  const t = getType(value);

  if (typeof expected === "function") {
    const msg = expected(value, path);
    if (getType(msg) === T_BOOLEAN) {
      if (msg === true) {
        error(path, "Invalid value");
      }
      // pass through
    } else {
      error(path, msg);
    }
  } else {
    if (t !== expected) {
      error(path, "Expected " + expected + ", got " + t);
    }
  }
  return value;
}

function expectIfDefined(expected, value, path) {
  if (value === undefined) return;
  return expectType(expected, value, path);
}

function mandatoryCheck(expected, opts, path, value) {
  if (value !== undefined) {
    return expectType(expected, value, path);
  } else {
    if (opts.defaultValue !== undefined) {
      return opts.defaultValue;
    } else if (opts.optional !== true) {
      error(path, "Missing value");
    }
  }
}

function simpleSchema(expected, opts, path) {
  expectIfDefined(expected, opts.defaultValue, path);
  return (value, path = ROOT) => mandatoryCheck(expected, opts, path, value);
}

function undefinedSchema(_opts, _path) {
  return (value, path) => expectType(T_UNDEFINED, value, path);
}

function nullSchema(opts = {}, path) {
  return simpleSchema(T_NULL, opts, path);
}

function booleanSchema(opts = {}, path) {
  return simpleSchema(T_BOOLEAN, opts, path);
}

function numberSchema(opts = {}, path) {
  const simple = simpleSchema(T_NUMBER, opts, path);
  return (v, path = ROOT) => {
    const value = simple(v, path);
    if (opts.integersOnly === true && !isInteger(value)) {
      error(path, "Expected an integer number");
    }
    return value;
  };
}

function isInteger(value) {
  return getType(value) === T_NUMBER && Math.floor(value) === value;
}

function checkInteger(value) {
  return !isInteger(value);
}

function integerSchema(opts = {}, path) {
  return simpleSchema(checkInteger, opts, path);
}

function numberStringSchema(opts = {}, path) {
  expectIfDefined(T_NUMBER, opts.defaultValue, path);
  return (v, path = ROOT) => {
    const value = mandatoryCheck(T_STRING, opts, path, v);
    if (value === undefined) return;
    const num = parseFloat(value);
    if (isNaN(num)) {
      error(path, "Invalid number");
    }
    return num;
  };
}

function stringSchema(opts = {}, path) {
  return simpleSchema(T_STRING, opts, path);
}

function dateSchema(opts = {}, path) {
  return simpleSchema(T_DATE, opts, path);
}

function functionSchema(opts = {}, path) {
  return simpleSchema(T_FUNCTION, opts, path);
}

function arraySchema(opts = {}, path) {
  if (opts[ARRAY_SUB_TYPE_FIELD] === undefined) {
    error(path, "Array needs a subType");
  }
  const subType = schema(opts[ARRAY_SUB_TYPE_FIELD]);
  return (v, path = ROOT) => {
    const value = mandatoryCheck(T_ARRAY, opts, path, v);
    if (value === undefined) return;
    return value.map((item, i) => subType(item, new Path(path, value, i + "")));
  };
}

function multiSchema(opts = {}, path) {
  if (getType(opts[MULTI_SUB_TYPES_FIELD]) !== T_ARRAY) {
    error(path, "Multi needs a subTypes array");
  }
  const subTypes = opts[MULTI_SUB_TYPES_FIELD].map(schema);
  return (v, path = ROOT) => {
    const value = mandatoryCheck(T_ARRAY, opts, path, v);
    return subTypes.map((sub, i) =>
      sub(value[i], new Path(path, value, i + ""))
    );
  };
}

function enumSchema(opts = {}, path) {
  if (getType(opts[ENUM_VALUES_FIELD]) !== T_ARRAY) {
    error(path, "Enum needs a values array");
  }
  return (v, path = ROOT) =>
    mandatoryCheck(
      value => opts[ENUM_VALUES_FIELD].indexOf(value) < 0,
      opts,
      path,
      v
    );
}

const fieldsSchema = (fields, path) =>
  Object.keys(fields).reduce((res, key) => {
    res[key] = schema(fields[key], new Path(path, fields, key));
    return res;
  }, {});

function objectSchema(opts = {}, path) {
  if (opts[OBJECT_FIELDS_FIELD] === undefined) {
    error(path, "Object needs a subTypes");
  }
  const fields = fieldsSchema(opts[OBJECT_FIELDS_FIELD], path);
  return (v, path = ROOT) => {
    const value = mandatoryCheck(T_OBJECT, opts, path, v);
    if (value === undefined) return;
    return Object.keys(fields).reduce((res, name) => {
      const fieldValue = fields[name](value[name], new Path(path, value, name));
      if (fieldValue !== undefined) {
        res[name] = fieldValue;
      }
      return res;
    }, {});
  };
}

function regexpSchema(opts = {}, path) {
  expectType(T_REGEXP, opts.pattern, path);
  const convert =
    getType(opts.convert) === T_FUNCTION ? opts.convert : m => m[0];

  return (v, path = ROOT) => {
    const value = mandatoryCheck(T_STRING, opts, path, v);
    const m = opts.pattern.exec(value);
    if (!m) {
      error(
        path,
        "String " +
          JSON.stringify(value) +
          " didn't match regular expression " +
          opts.pattern
      );
    }
    return convert(m);
  };
}

const handleFunction = (func, opts = {}, path) => {
  switch (func) {
    case Boolean:
      return booleanSchema(opts, path);
    case Number:
      return numberSchema(opts, path);
    case String:
      return stringSchema(opts, path);
    case Date:
      return dateSchema(opts, path);
    case RegExp:
      return regexpSchema(opts, path);
    case Array:
      return arraySchema(opts, path);
    case Object:
      return objectSchema(opts, path);
    case Function:
      return functionSchema(opts, path);
    default:
      return func(opts, path, schema);
  }
};

function handleArray(value, path) {
  if (value.length === 0) {
    error(path, "Array needs at least one element to define its item type.");
  }
  if (value.length === 1) {
    return arraySchema({ [ARRAY_SUB_TYPE_FIELD]: value[0] }, path);
  } else {
    return multiSchema({ [MULTI_SUB_TYPES_FIELD]: value }, path);
  }
}

function handleObject(value, path) {
  if (value[TYPE_FIELD] !== undefined) {
    if (typeof value[TYPE_FIELD] !== "function") {
      error(path, "$type must be a simple js type constructor");
    }
    return handleFunction(value[TYPE_FIELD], dropType(value), path);
  } else {
    return objectSchema({ [OBJECT_FIELDS_FIELD]: value }, path);
  }
}

function isSchema(value) {
  return typeof value === "function" && value.__schema === true;
}

function schema(value, path = ROOT) {
  function parse() {
    const t = getType(value);
    switch (t) {
      case T_UNDEFINED:
        return undefinedSchema(null, path);
      case T_NULL:
        return nullSchema({ [DEFAULT_FIELD]: null }, path);
      case T_BOOLEAN:
        return booleanSchema({ [DEFAULT_FIELD]: value }, path);
      case T_NUMBER:
        return numberSchema({ [DEFAULT_FIELD]: value }, path);
      case T_STRING:
        return stringSchema({ [DEFAULT_FIELD]: value }, path);
      case T_ARRAY:
        return handleArray(value, path);
      case T_OBJECT:
        return handleObject(value, path);
      case T_REGEXP:
        return regexpSchema({ pattern: value }, path);
      case T_DATE:
        return dateSchema({ [DEFAULT_FIELD]: value }, path);
      case T_FUNCTION:
        return handleFunction(value, {}, path);
      default:
        error(path, "InternalError: getType returned invalid type name: " + t);
    }
  }

  function asSchema(f) {
    f.__schema = true;
    return f;
  }

  return isSchema(value) ? value : asSchema(parse());
}

schema.types = {
  Undefined: undefinedSchema,
  Null: nullSchema,
  Boolean: booleanSchema,
  Number: numberSchema,
  NumberString: numberStringSchema,
  Integer: integerSchema,
  String: stringSchema,
  Array: arraySchema,
  Multi: multiSchema,
  Enum: enumSchema,
  Object: objectSchema,
  RegExp: regexpSchema,
  Date: dateSchema,
  Function: functionSchema
};

schema.getType = getType;
schema.isSchema = isSchema;
schema.Path = Path;

module.exports = schema;
