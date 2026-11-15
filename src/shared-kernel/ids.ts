// Identifiers are UUIDs made by the database (gen_random_uuid) or by the browser (crypto.randomUUID, for
// client_op_id). This only checks the SHAPE, so a broken value is refused with a clear message before it
// reaches the database.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
