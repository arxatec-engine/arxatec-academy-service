export const ValidationKeys = {
  auth: {
    full_name_required: 'auth.errors.full_name_required',
    full_name_too_long: 'auth.errors.full_name_too_long',
    email_invalid: 'auth.errors.email_invalid',
    email_too_long: 'auth.errors.email_too_long',
    password_too_short: 'auth.errors.password_too_short',
    password_too_long: 'auth.errors.password_too_long',
    city_invalid: 'auth.errors.city_invalid',
    city_other_required: 'auth.errors.city_other_required',
    city_other_too_long: 'auth.errors.city_other_too_long',
    organization_too_long: 'auth.errors.organization_too_long',
    remember_me_invalid: 'auth.errors.remember_me_invalid',
    token_required: 'auth.errors.token_required',
    code_required: 'auth.errors.code_required',
    redirect_to_invalid: 'auth.errors.redirect_to_invalid',
  },
  courses: {
    slug_required: 'courses.errors.slug_required',
    slug_too_long: 'courses.errors.slug_too_long',
    lesson_slug_required: 'courses.errors.lesson_slug_required',
    lesson_slug_too_long: 'courses.errors.lesson_slug_too_long',
    topic_invalid: 'courses.errors.topic_invalid',
    level_invalid: 'courses.errors.level_invalid',
    search_too_long: 'courses.errors.search_too_long',
    title_required: 'courses.errors.title_required',
    title_too_long: 'courses.errors.title_too_long',
    short_description_too_long: 'courses.errors.short_description_too_long',
    expected_updated_at_required: 'courses.errors.expected_updated_at_required',
    course_ids_invalid: 'courses.errors.course_ids_invalid',
  },
  progress: {
    lesson_id_required: 'progress.errors.lesson_id_required',
    lesson_id_too_long: 'progress.errors.lesson_id_too_long',
    position_invalid: 'progress.errors.position_invalid',
    completed_invalid: 'progress.errors.completed_invalid',
  },
  comments: {
    lesson_id_required: 'comments.errors.lesson_id_required',
    lesson_id_too_long: 'comments.errors.lesson_id_too_long',
    comment_id_required: 'comments.errors.comment_id_required',
    comment_id_too_long: 'comments.errors.comment_id_too_long',
    body_required: 'comments.errors.body_required',
    body_too_long: 'comments.errors.body_too_long',
    reason_too_long: 'comments.errors.reason_too_long',
  },
  user: {
    current_password_required: 'user.errors.current_password_required',
    password_same_as_current: 'user.errors.password_same_as_current',
    password_required: 'user.errors.password_required',
    avatar_required: 'user.errors.avatar_required',
  },
  common: {
    invalid: 'errors.validation.invalid',
    required: 'errors.validation.required',
  },
} as const;

const I18N_KEY_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/;

export const isI18nKey = (value: string): boolean => I18N_KEY_PATTERN.test(value);

export const ValidationRootField = 'form';
