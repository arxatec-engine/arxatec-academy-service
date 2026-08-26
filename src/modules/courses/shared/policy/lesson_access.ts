export interface LessonAccessInput {
  is_free_sample: boolean;
  has_session: boolean;
}

export const canViewLesson = ({ is_free_sample, has_session }: LessonAccessInput): boolean =>
  is_free_sample || has_session;
