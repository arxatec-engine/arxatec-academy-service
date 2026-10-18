import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import type { CertificateRecord } from '@/modules/progress/shared/domain/certificate.types';

export const issueCourseCertificate = async (
  client: Prisma.TransactionClient,
  key: { user_id: string; course_id: string },
  exam_attempt_id: string,
): Promise<void> => {
  const attempt = await client.exam_attempts.findFirst({
    where: { id: exam_attempt_id, ...key, passed: true },
    select: { submitted_at: true },
  });
  if (attempt === null) {
    return;
  }
  const enrollment = await client.enrollments.findUniqueOrThrow({
    where: { user_id_course_id: key },
    select: {
      completed_at: true,
      user: { select: { full_name: true } },
      course: { select: { title: true } },
    },
  });
  if (enrollment.completed_at === null) {
    return;
  }

  await client.certificates.createMany({
    data: {
      ...key,
      recipient_name: enrollment.user.full_name,
      course_title: enrollment.course.title,
      completed_at: attempt.submitted_at,
      exam_attempt_id,
    },
    skipDuplicates: true,
  });
};

export const findCertificateById = async (id: string): Promise<CertificateRecord | null> =>
  prisma.certificates.findUnique({
    where: { id },
    select: {
      id: true,
      recipient_name: true,
      course_title: true,
      completed_at: true,
      issued_at: true,
    },
  });
