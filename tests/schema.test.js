const schema = require("../src/index");

test("Undefined default", () => {
  expect(schema(undefined)()).toEqual(undefined);
});

test("Undefined failure", () => {
  expect(() => schema(undefined)(3)).toThrow();
});

test("Null default", () => {
  expect(schema(null)()).toEqual(null);
});

test("Null failure", () => {
  expect(() => schema(null)("wrong")).toThrow();
});

test("Boolean default", () => {
  expect(schema(false)()).toEqual(false);
});

test("Boolean default (opts)", () => {
  expect(schema({ $type: Boolean, defaultValue: true })()).toEqual(true);
});

test("Boolean type function", () => {
  expect(schema(Boolean)(true)).toEqual(true);
});

test("Boolean failure", () => {
  expect(() => schema(Boolean)(12)).toThrow();
});

test("Number default", () => {
  expect(schema(1.23)()).toEqual(1.23);
});

test("Number default (opts)", () => {
  expect(schema({ $type: Number, defaultValue: 3.14 })()).toEqual(3.14);
});

test("Number type function", () => {
  expect(schema(Number)(3.4)).toEqual(3.4);
});

test("Number failure", () => {
  expect(() => schema(Number)("xxx")).toThrow();
});

test("String default", () => {
  expect(schema("test")()).toEqual("test");
});

test("String default (opts)", () => {
  expect(schema({ $type: String, defaultValue: "yes" })()).toEqual("yes");
});

test("String type function", () => {
  expect(schema(String)("foo")).toEqual("foo");
});

test("String failure", () => {
  expect(() => schema(String)(53.44)).toThrow();
});

test("Array default", () => {
  expect(schema(["foo"])([undefined])).toEqual(["foo"]);
});

test("Array default (opts)", () => {
  expect(
    schema({ $type: Array, subType: String, defaultValue: ["foo"] })()
  ).toEqual(["foo"]);
});

test("Array content", () => {
  expect(schema([Number])([1, 2])).toEqual([1, 2]);
});

test("Array failure", () => {
  expect(() => schema([String])(3.23)).toThrow();
});

test("Array content failure", () => {
  expect(() => schema([String])([3.23])).toThrow();
});

test("Multi default", () => {
  expect(schema([1, "foo"])([])).toEqual([1, "foo"]);
});

test("Multi default (opts)", () => {
  expect(
    schema({
      $type: schema.types.Multi,
      subTypes: [Number, String],
      defaultValue: [1, "foo"]
    })()
  ).toEqual([1, "foo"]);
});

test("Multi content", () => {
  expect(schema([Number, String])([1, "bar"])).toEqual([1, "bar"]);
});

test("Multi failure", () => {
  expect(() => schema([String, Number])(42.34)).toThrow();
});

test("Multi content failure", () => {
  expect(() => schema([String, Number])(["foo", false])).toThrow();
});

test("Date default", () => {
  const d = new Date(1980, 3, 3);
  expect(schema(d)()).toEqual(d);
});

test("Date default (opts)", () => {
  const d = new Date(1980, 3, 3);
  expect(schema({ $type: Date, defaultValue: d })()).toEqual(d);
});

test("Date failure", () => {
  expect(() => schema(Date)(1.2)).toThrow();
});

test("Function default (opts)", () => {
  const f = () => "x";
  expect(schema({ $type: Function, defaultValue: f })()).toEqual(f);
});

test("Function failure", () => {
  expect(() => schema(Function)("not a func")).toThrow();
});

test("RegExp simple", () => {
  expect(schema(/foo/)("foo")).toEqual("foo");
});

test("RegExp default (opts)", () => {
  expect(
    schema({ $type: RegExp, pattern: /[a-z]+/, defaultValue: "test" })()
  ).toEqual("test");
});

test("RegExp failure", () => {
  expect(() => schema(/foo/)(3)).toThrow();
});

test("RegExp pattern failure", () => {
  expect(() => schema(/foo/)("bar")).toThrow();
});

test("RegExp pattern success with convert", () => {
  expect(
    schema({
      $type: RegExp,
      pattern: /^ *var_([0-9]+) *$/,
      convert: m => parseInt(m[1], 10)
    })("var_123")
  ).toEqual(123);
});

test("Custom parser simple", () => {
  expect(schema((_opts, _path, _schema) => (v, _path) => v)("y")).toEqual("y");
});

test("Enum", () => {
  expect(schema({ $type: schema.types.Enum, values: ["a", "b"] })("b")).toEqual(
    "b"
  );
});

test("Enum default (opts)", () => {
  expect(
    schema({
      $type: schema.types.Enum,
      values: ["a", "b"],
      defaultValue: "a"
    })()
  ).toEqual("a");
});

test("Enum failure", () => {
  expect(() =>
    schema({
      $type: schema.types.Enum,
      values: ["a", "b"]
    })("c")
  ).toThrow();
});

test("Object without $type", () => {
  expect(
    schema({
      name: String
    })({ name: "John" })
  ).toEqual({ name: "John" });
});

test("Object with $type", () => {
  expect(
    schema({
      $type: Object,
      fields: {
        name: String
      }
    })({ name: "John" })
  ).toEqual({ name: "John" });
});

test("Object with default", () => {
  expect(
    schema({
      $type: Object,
      fields: {
        name: String,
        age: Number
      },
      defaultValue: {
        name: "unknown",
        age: 0
      }
    })()
  ).toEqual({ name: "unknown", age: 0 });
});

const Address = {
  street: String,
  code: Number,
  city: String
};

const Car = [
  "unknown brand",
  "unknown model",
  { $type: Number, defaultValue: 0 }
];

const Person = {
  name: String,
  address: Address,
  cars: [Car]
};

test("Deep parse success", () => {
  const data = {
    name: "John Doe",
    address: {
      street: "405 Lexington Ave",
      code: 10174,
      city: "New York"
    },
    cars: [["BMW", "M3", 600]]
  };
  expect(schema(Person)(data)).toEqual(data);
});

test("Deep parse failure", () => {
  const data = {
    name: "John Doe",
    address: {
      street: "405 Lexington Ave",
      code: "10174",
      city: "New York"
    },
    cars: [["BMW", "M3", 600]]
  };
  expect(() => schema(Person)(data)).toThrow();
});
