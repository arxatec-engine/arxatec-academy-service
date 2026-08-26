export interface HttpStatus {
  readonly code: number;
  readonly message: string;
}

export const HttpStatusCodes = {
  OK: { code: 200, message: 'OK' },
  CREATED: { code: 201, message: 'Created' },
  ACCEPTED: { code: 202, message: 'Accepted' },
  NO_CONTENT: { code: 204, message: 'No Content' },
  FOUND: { code: 302, message: 'Found' },
  BAD_REQUEST: { code: 400, message: 'Bad Request' },
  UNAUTHORIZED: { code: 401, message: 'Unauthorized' },
  FORBIDDEN: { code: 403, message: 'Forbidden' },
  NOT_FOUND: { code: 404, message: 'Not Found' },
  CONFLICT: { code: 409, message: 'Conflict' },
  GONE: { code: 410, message: 'Gone' },
  PAYLOAD_TOO_LARGE: { code: 413, message: 'Payload Too Large' },
  UNSUPPORTED_MEDIA_TYPE: { code: 415, message: 'Unsupported Media Type' },
  UNPROCESSABLE_ENTITY: { code: 422, message: 'Unprocessable Entity' },
  TOO_MANY_REQUESTS: { code: 429, message: 'Too Many Requests' },
  INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal Server Error' },
  BAD_GATEWAY: { code: 502, message: 'Bad Gateway' },
  SERVICE_UNAVAILABLE: { code: 503, message: 'Service Unavailable' },
} as const satisfies Record<string, HttpStatus>;

export type HttpStatusName = keyof typeof HttpStatusCodes;
