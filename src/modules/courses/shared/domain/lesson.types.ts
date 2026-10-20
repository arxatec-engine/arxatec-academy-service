import type { lesson_type, video_provider } from '@/generated/enums';

export interface LessonLockedRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: lesson_type;
  position: number;
  is_free_sample: boolean;
  duration_seconds: number | null;
  reading_minutes: number | null;
}

export interface LessonResourceRecord {
  title: string;
  file_url: string;
  file_key: string | null;
  mime_type: string;
  size_bytes: number;
}

export interface LessonUnlockedRecord extends LessonLockedRecord {
  video_provider: video_provider | null;
  video_external_id: string | null;
  article_body: string | null;
  transcript: string | null;
  updated_at: Date;
  resources: readonly LessonResourceRecord[];
}

export interface ApiLessonLocked {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: lesson_type;
  position: number;
  is_free_sample: boolean;
  duration_seconds: number | null;
  reading_minutes: number | null;
}

export interface ApiLessonVideo {
  provider: video_provider;
  external_id: string;
}

export interface ApiLessonResource {
  title: string;
  file_url: string;
  mime_type: string;
  size_bytes: number;
}

export interface ApiLessonUnlocked {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: lesson_type;
  position: number;
  is_free_sample: boolean;
  duration_seconds: number | null;
  video: ApiLessonVideo | null;
  article_body: string | null;
  reading_minutes: number | null;
  transcript: string | null;
  resources: readonly ApiLessonResource[];
  updated_at: string;
}

export interface ApiLessonCourse {
  slug: string;
  title: string;
  lesson_count: number;
}
