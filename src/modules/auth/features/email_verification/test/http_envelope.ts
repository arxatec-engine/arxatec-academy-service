import { z } from 'zod';

const httpEnvelopeSchema = z.object({
  status: z.number(),
  message: z.string(),
  description: z.string(),
  timestamp: z.string(),
  path: z.string(),
  data: z.object({ retry_after_seconds: z.number().optional() }).optional(),
  meta: z
    .object({
      code: z.string().optional(),
      retry_after_seconds: z.number().optional(),
      fields: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type HttpEnvelope = z.infer<typeof httpEnvelopeSchema>;

export const parseEnvelope = (body: unknown): HttpEnvelope => httpEnvelopeSchema.parse(body);
