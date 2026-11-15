// A tiny JSON Schema checker covering the subset these schemas use:
// type (string or list), enum, pattern, minimum, minLength, minItems, required,
// properties, additionalProperties: false, items. Zero dependencies on purpose.

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);

function matchesType(value, type) {
  const actual = typeOf(value);
  return type === actual || (type === "number" && actual === "integer");
}

export function validateSchema(value, schema, path = "$") {
  const errors = [];
  const types = schema.type === undefined ? null : [].concat(schema.type);
  if (types && !types.some((t) => matchesType(value, t))) return [`${path}: expected ${types.join(" or ")}, got ${typeOf(value)}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: ${value} is below ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => errors.push(...validateSchema(v, schema.items, `${path}[${i}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing required field "${key}"`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) errors.push(...validateSchema(value[key], sub, `${path}.${key}`));
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}: unexpected field "${key}"`);
    }
  }
  return errors;
}
