import { z } from 'zod';

import { CatalogPolicy } from '@/constants/courses';
import { ValidationKeys } from '@/constants/validation_keys';
import { course_level, course_topic } from '@/generated/enums';

const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const splitValues = (value: string): string[] =>
  value
    .split(CatalogPolicy.multi_value_separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const toValueList = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return splitValues(value);
  }

  if (isUnknownArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? splitValues(item) : []));
  }

  return [];
};

const readFirstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (isUnknownArray(value)) {
    return value.find((item): item is string => typeof item === 'string');
  }

  return undefined;
};

const toSearchTerm = (value: unknown): string | undefined => {
  const term = readFirstString(value)?.trim();

  return term === undefined || term.length === 0 ? undefined : term;
};

export const getListSchema = z.object({
  topic: z.preprocess(
    toValueList,
    z.array(z.enum(course_topic, ValidationKeys.courses.topic_invalid)),
  ),
  level: z.preprocess(
    toValueList,
    z.array(z.enum(course_level, ValidationKeys.courses.level_invalid)),
  ),
  search: z.preprocess(
    toSearchTerm,
    z
      .string()
      .max(CatalogPolicy.search_max_length, ValidationKeys.courses.search_too_long)
      .optional(),
  ),
});
