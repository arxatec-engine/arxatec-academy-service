import { argon2id, hash } from 'argon2';

import { isProduction } from '@/config/env';
import { logger } from '@/config/logger';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { CoursePolicy } from '@/constants/courses';
import { SystemMessages } from '@/constants/messages/system';
import { auth_provider } from '@/generated/enums';
import { storage } from '@/infrastructure/storage/storage';
import { resolveLessonContent } from '@/modules/courses/shared/policy/lesson_content_policy';
import { buildSeedComments, type SeedCommentAuthor } from '@/seed/seed_comments';
import { buildSeedCourses, type SeedCourse, type SeedLesson } from '@/seed/seed_courses';
import { buildSeedUsers } from '@/seed/seed_data';
import { readSeedCredentials, type SeedCredentials } from '@/seed/seed_env';
import { seedExams } from '@/seed/seed_exams';
import { seedNotifications, type SeedNotificationUser } from '@/seed/seed_notifications';

const seedUsers = async (
  credentials: SeedCredentials,
): Promise<readonly SeedNotificationUser[]> => {
  const authors: SeedNotificationUser[] = [];

  for (const user of buildSeedUsers(credentials)) {
    const password_hash = await hash(user.password, { type: argon2id });

    const saved = await prisma.users.upsert({
      where: { email: user.email },
      update: {
        full_name: user.full_name,
        role: user.role,
        city: user.city,
        organization: user.organization,
        is_independent: user.is_independent,
        password_hash,
      },
      create: {
        full_name: user.full_name,
        email: user.email,
        password_hash,
        role: user.role,
        city: user.city,
        organization: user.organization,
        is_independent: user.is_independent,
        auth_provider: auth_provider.PASSWORD,
        email_verified_at: new Date(),
      },
      select: { id: true, email: true, role: true },
    });

    authors.push(saved);

    logger.info(
      { id: saved.id, email: saved.email, role: saved.role },
      SystemMessages.seed_user_created,
    );
  }

  return authors;
};

const seedLesson = async (
  course_id: string,
  lesson: SeedLesson,
  position: number,
): Promise<string> => {
  const resolved = resolveLessonContent(lesson.content);

  if (!resolved.valid) {
    throw new Error(`${SystemMessages.seed_lesson_content_invalid} (${lesson.slug})`);
  }

  const fields = {
    title: lesson.title,
    description: lesson.description,
    type: lesson.content.type,
    position,
    is_free_sample: lesson.is_free_sample,
    status: lesson.status,
    transcript: lesson.transcript ?? null,
    ...resolved.content,
  };

  const saved = await prisma.lessons.upsert({
    where: { course_id_slug: { course_id, slug: lesson.slug } },
    update: fields,
    create: { course_id, slug: lesson.slug, ...fields },
    select: { id: true },
  });

  await prisma.lesson_resources.deleteMany({ where: { lesson_id: saved.id } });

  for (const resource of lesson.resources) {
    await prisma.lesson_resources.create({
      data: {
        lesson_id: saved.id,
        title: resource.title,
        file_url: storage.publicUrl(resource.file_key),
        mime_type: resource.mime_type,
        size_bytes: resource.size_bytes,
        position: resource.position,
      },
      select: { id: true },
    });
  }

  return saved.id;
};

const seedCourse = async (
  course: SeedCourse,
  authors: readonly SeedCommentAuthor[],
): Promise<void> => {
  const fields = {
    title: course.title,
    short_description: course.short_description,
    long_description: course.long_description,
    topic: course.topic,
    level: course.level,
    status: course.status,
    catalog_order: course.catalog_order,
    published_at: course.published_at,
  };

  const saved = await prisma.courses.upsert({
    where: { slug: course.slug },
    update: fields,
    create: { slug: course.slug, ...fields },
    select: { id: true, slug: true },
  });

  await prisma.lessons.deleteMany({
    where: { course_id: saved.id, slug: { notIn: course.lessons.map((lesson) => lesson.slug) } },
  });

  let commentsCreated = 0;

  for (const [index, lesson] of course.lessons.entries()) {
    const position = CoursePolicy.first_position + index;
    const lesson_id = await seedLesson(saved.id, lesson, position);
    const comments = buildSeedComments(
      { id: lesson_id, title: lesson.title, position },
      authors,
      course.published_at,
    );
    const result = await prisma.comments.createMany({ data: [...comments], skipDuplicates: true });

    commentsCreated += result.count;
  }

  logger.info(
    {
      id: saved.id,
      slug: saved.slug,
      lessons: course.lessons.length,
      comments_created: commentsCreated,
    },
    SystemMessages.seed_course_created,
  );
};

const seedCourses = async (authors: readonly SeedCommentAuthor[]): Promise<void> => {
  for (const course of buildSeedCourses()) {
    await seedCourse(course, authors);
  }
};

const run = async (): Promise<void> => {
  if (isProduction) {
    logger.error(SystemMessages.seed_forbidden_in_production);
    process.exitCode = 1;

    return;
  }

  const credentials = readSeedCredentials();

  if (credentials === null) {
    logger.error(SystemMessages.seed_credentials_missing);
    process.exitCode = 1;

    return;
  }

  logger.info(SystemMessages.seed_started);

  try {
    const authors = await seedUsers(credentials);

    await seedCourses(authors);
    const courses = await prisma.courses.findMany({
      where: { slug: { in: buildSeedCourses().map((course) => course.slug) } },
      select: { id: true, slug: true },
    });
    const exams = await seedExams(prisma, courses);
    logger.info(exams, SystemMessages.seed_exams_created);
    const notices = await seedNotifications(prisma, authors, courses);
    logger.info(notices, SystemMessages.seed_notifications_created);
    logger.info(SystemMessages.seed_finished);
  } catch (error: unknown) {
    logger.error({ err: error }, SystemMessages.seed_failed);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
};

void run();
