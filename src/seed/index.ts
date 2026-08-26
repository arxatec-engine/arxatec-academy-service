import { argon2id, hash } from 'argon2';

import { isProduction } from '@/config/env';
import { logger } from '@/config/logger';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { CoursePolicy } from '@/constants/courses';
import { SystemMessages } from '@/constants/messages/system';
import { auth_provider } from '@/generated/enums';
import { storage } from '@/infrastructure/storage/storage';
import { resolveLessonContent } from '@/modules/courses/shared/policy/lesson_content_policy';
import { buildSeedCourses, type SeedCourse, type SeedLesson } from '@/seed/seed_courses';
import { buildSeedUsers } from '@/seed/seed_data';
import { readSeedCredentials, type SeedCredentials } from '@/seed/seed_env';

const seedUsers = async (credentials: SeedCredentials): Promise<void> => {
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

    logger.info(
      { id: saved.id, email: saved.email, role: saved.role },
      SystemMessages.seed_user_created,
    );
  }
};

const seedLesson = async (
  course_id: string,
  lesson: SeedLesson,
  position: number,
): Promise<void> => {
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
};

const seedCourse = async (course: SeedCourse): Promise<void> => {
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

  for (const [index, lesson] of course.lessons.entries()) {
    await seedLesson(saved.id, lesson, CoursePolicy.first_position + index);
  }

  logger.info(
    { id: saved.id, slug: saved.slug, lessons: course.lessons.length },
    SystemMessages.seed_course_created,
  );
};

const seedCourses = async (): Promise<void> => {
  for (const course of buildSeedCourses()) {
    await seedCourse(course);
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
    await seedUsers(credentials);
    await seedCourses();
    logger.info(SystemMessages.seed_finished);
  } catch (error: unknown) {
    logger.error({ err: error }, SystemMessages.seed_failed);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
};

void run();
