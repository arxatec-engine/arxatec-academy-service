import { isProduction } from '@/config/env';
import { logger } from '@/config/logger';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { SystemMessages } from '@/constants/messages/system';
import { buildSeedCourses } from '@/seed/seed_courses';
import { seedExams } from '@/seed/seed_exams';

const run = async (): Promise<void> => {
  if (isProduction) {
    logger.error(SystemMessages.seed_forbidden_in_production);
    process.exitCode = 1;
    return;
  }
  try {
    const courses = await prisma.courses.findMany({
      where: { slug: { in: buildSeedCourses().map((course) => course.slug) } },
      select: { id: true, slug: true },
    });
    const result = await seedExams(prisma, courses);
    logger.info(result, SystemMessages.seed_exams_created);
  } catch (error: unknown) {
    logger.error({ err: error }, SystemMessages.seed_failed);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
  }
};

void run();
