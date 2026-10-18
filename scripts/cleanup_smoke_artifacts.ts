import { prisma, disconnectPrisma } from '@/config/prisma_client';
import { storage } from '@/infrastructure/storage/storage';

const [userId, courseId] = process.argv.slice(2);

const cleanup = async (): Promise<void> => {
  const files = new Set<string>();
  if (userId) {
    const user = await prisma.users.findUnique({ where: { id: userId },
      select: { email: true, avatar_key: true } });
    if (user !== null) {
      if (!/^smoke-\d+-\d+@example\.test$/.test(user.email)) {
        throw new Error('Refusing to delete a non-smoke user');
      }
      if (user.avatar_key) {files.add(user.avatar_key);}
      await prisma.users.delete({ where: { id: userId }, select: { id: true } });
    }
  }
  if (courseId) {
    const course = await prisma.courses.findUnique({ where: { id: courseId },
      select: { title: true, cover_image_key: true,
        lessons: { select: { resources: { select: { file_key: true } } } } } });
    if (course !== null) {
      if (!/^Smoke Curso \d+-\d+$/.test(course.title)) {
        throw new Error('Refusing to delete a non-smoke course');
      }
      if (course.cover_image_key) {files.add(course.cover_image_key);}
      for (const lesson of course.lessons) {
        for (const resource of lesson.resources) {
          if (resource.file_key) {files.add(resource.file_key);}
        }
      }
      await prisma.courses.delete({ where: { id: courseId }, select: { id: true } });
    }
  }
  for (const key of files) {await storage.remove(key);}
};

void cleanup().finally(async () => {await disconnectPrisma();});
