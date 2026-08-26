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

export const FilesRoutePrefix = '/files';

export const FrontendRoutes = {
  home: '/',
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
