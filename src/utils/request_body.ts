export const readBodyField = (body: unknown, field: string): unknown =>
  typeof body === 'object' && body !== null && field in body ? Reflect.get(body, field) : undefined;
