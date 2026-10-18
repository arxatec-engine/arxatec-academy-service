export const ApiPrefix = '/api/v1';

export const HealthEndpoints = {
  ping: '/ping',
} as const;

export const AuthRoutePrefix = '/auth';

export const AuthEndpoints = {
  register: '/register',
  login: '/login',
  logout: '/logout',
  me: '/me',
  password_forgot: '/password/forgot',
  password_reset: '/password/reset',
  email_verify: '/email/verify',
  email_resend: '/email/resend',
  google_start: '/google',
  google_callback: '/google/callback',
  google_exchange: '/google/exchange',
} as const;

export const CoursesRoutePrefix = '/courses';
export const AdminTeacherRoutePrefix = '/teachers';
export const AdminTeacherEndpoints = { list: '/' } as const;

export const CourseEndpoints = {
  list: '/',
  detail: '/:slug',
  lesson_detail: '/:course_slug/lessons/:lesson_slug',
} as const;

export const CourseRouteParams = {
  slug: 'slug',
  course_slug: 'course_slug',
  lesson_slug: 'lesson_slug',
} as const;

export const LessonsRoutePrefix = '/lessons';

export const MeRoutePrefix = '/me';

export const CertificatesRoutePrefix = '/certificates';
export const CertificateEndpoints = { detail: '/:id', download: '/:id/pdf' } as const;
export const ExamEndpoints = { detail: '/:slug/exam', submit: '/:slug/exam/attempts' } as const;

export const ProgressEndpoints = {
  enroll: '/:slug/enroll',
  lesson_progress: '/:lesson_id/progress',
  lesson_complete: '/:lesson_id/complete',
  my_courses: '/courses',
} as const;

export const ProgressRouteParams = {
  slug: 'slug',
  lesson_id: 'lesson_id',
} as const;

export const CommentsRoutePrefix = '/comments';

export const CommentEndpoints = {
  lesson_comments: '/:lesson_id/comments',
  replies: '/:comment_id/replies',
  report: '/:comment_id/report',
} as const;

export const CommentRouteParams = {
  lesson_id: 'lesson_id',
  comment_id: 'comment_id',
} as const;

export const UserEndpoints = {
  profile: '/profile',
  password: '/password',
  avatar: '/avatar',
  account: '/',
  summary: '/summary',
} as const;

export const AdminRoutePrefix = '/admin';

export const AdminCourseRoutePrefix = '/courses';

export const AdminCourseEndpoints = {
  list: '/',
  order: '/order',
  detail: '/:id',
  publish: '/:id/publish',
  unpublish: '/:id/unpublish',
  duplicate: '/:id/duplicate',
  archive: '/:id/archive',
  cover: '/:id/cover',
  lessons: '/:course_id/lessons',
  lessons_order: '/:course_id/lessons/order',
  exam: '/:id/exam',
} as const;

export const AdminLessonRoutePrefix = '/lessons';
export const AdminLessonEndpoints = {
  detail: '/:id',
  publish: '/:id/publish',
  resources: '/:lesson_id/resources',
  resource: '/:lesson_id/resources/:id',
  resources_order: '/:lesson_id/resources/order',
} as const;

export const AdminVideoEndpoints = { probe: '/videos/probe' } as const;

export const AdminCommentsRoutePrefix = '/comments';
export const AdminCommentEndpoints = {
  list: '/', counts: '/counts', replies: '/:id/replies',
  status: '/:id/status', detail: '/:id',
} as const;

export const AdminUsersEndpoints = { list: '/users', export: '/users/export' } as const;

export const NotificationsRoutePrefix = '/notifications';
export const NotificationEndpoints = { signups: '/signups', topics: '/topics' } as const;
export const AdminNotificationEndpoints = {
  signups: '/signups', export: '/signups/export', notify: '/signups/notify',
  topics: '/topics', subscribers: '/subscribers',
} as const;

export const FilesRoutePrefix = '/files';

export const FrontendRoutes = {
  home: '/',
  certificate: '/certificados',
  login: '/ingresar',
  register: '/crear-cuenta',
  forgot_password: '/recuperar-contrasena',
  reset_password: '/restablecer-contrasena',
  check_email: '/revisa-tu-correo',
  verify_email: '/verificar-correo',
  oauth_callback: '/oauth/callback',
  session_expired: '/sesion-vencida',
} as const;

export const QueryParams = {
  token: 'token',
  code: 'code',
  state: 'state',
  redirect_to: 'redirect_to',
} as const;
