import type { Prisma } from '@/generated/client';
import { ExamPolicy } from '@/constants/exams';
import { SystemMessages } from '@/constants/messages/system';
import { examQuestionsSchema } from '@/modules/progress/shared/domain/exam.schema';
import { buildSeedCourses } from '@/seed/seed_courses';
import { seedExamQuestions } from '@/seed/seed_exam_questions';

interface SeedExamCourse {
  id: string;
  slug: string;
}

interface SeedExamClient {
  course_exams: {
    createMany(input: {
      data: Prisma.course_examsCreateManyInput[];
      skipDuplicates: true;
    }): Promise<{ count: number }>;
  };
}

export const buildSeedExams = () =>
  buildSeedCourses().map((course) => {
    const drafts = seedExamQuestions[course.slug];
    if (!drafts) {
      throw new Error(SystemMessages.seed_exam_questions_missing);
    }

    const questions = drafts.map(([text, correct, ...incorrect], index) => {
      const correct_option = index % ExamPolicy.option_count;
      const options = [...incorrect];
      options.splice(correct_option, 0, correct);
      return { text, options, correct_option };
    });

    return {
      course_slug: course.slug,
      enabled: true,
      passing_score: ExamPolicy.passing_score,
      questions: examQuestionsSchema.parse(questions),
    };
  });

export const seedExams = async (client: SeedExamClient, courses: readonly SeedExamCourse[]) => {
  const coursesBySlug = new Map(courses.map((course) => [course.slug, course.id]));
  const definitions = buildSeedExams();
  const data = definitions.flatMap(({ course_slug, ...exam }) => {
    const course_id = coursesBySlug.get(course_slug);
    return course_id === undefined ? [] : [{ ...exam, course_id }];
  });
  const result = await client.course_exams.createMany({ data, skipDuplicates: true });
  return {
    created: result.count,
    preserved: data.length - result.count,
    missing_courses: definitions.length - data.length,
  };
};
