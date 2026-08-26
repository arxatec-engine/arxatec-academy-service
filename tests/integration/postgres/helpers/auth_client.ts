import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';

export type AuthEndpointName = keyof typeof AuthEndpoints;

export const envelopeSchema = z.object({
  status: z.number(),
  message: z.string(),
  description: z.string(),
  timestamp: z.string(),
  path: z.string(),
  data: z.unknown().optional(),
  meta: z
    .object({
      code: z.string().optional(),
      fields: z.record(z.string(), z.string()).optional(),
      retry_after_seconds: z.number().optional(),
    })
    .optional(),
});

export const apiUserSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  role: z.string(),
  organization: z.string().nullable(),
  is_independent: z.boolean(),
  city: z.string(),
  city_other: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email_verified_at: z.string().nullable(),
  auth_provider: z.string(),
  created_at: z.string(),
});

export const sessionDataSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  user: apiUserSchema,
});

export type Envelope = z.infer<typeof envelopeSchema>;

export interface ApiResponse {
  status: number;
  body: Envelope;
  raw_body: unknown;
}

export const authPath = (endpoint: AuthEndpointName): string =>
  `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints[endpoint]}`;

const bearer = (token: string): string => `${AuthHeaders.bearer_prefix}${token}`;

export const postJson = async (
  app: Express,
  endpoint: AuthEndpointName,
  body: Record<string, unknown>,
  bearer_token?: string,
): Promise<ApiResponse> => {
  const pending = request(app).post(authPath(endpoint)).send(body);

  if (bearer_token !== undefined) {
    void pending.set(AuthHeaders.authorization, bearer(bearer_token));
  }

  const response = await pending;
  const raw_body: unknown = response.body;

  return { status: response.status, body: envelopeSchema.parse(raw_body), raw_body };
};

export const getJson = async (
  app: Express,
  endpoint: AuthEndpointName,
  bearer_token?: string,
): Promise<ApiResponse> => {
  const pending = request(app).get(authPath(endpoint));

  if (bearer_token !== undefined) {
    void pending.set(AuthHeaders.authorization, bearer(bearer_token));
  }

  const response = await pending;
  const raw_body: unknown = response.body;

  return { status: response.status, body: envelopeSchema.parse(raw_body), raw_body };
};
