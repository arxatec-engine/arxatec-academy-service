import { listTeachers } from '@/modules/courses/shared/data/teachers.repository';

export const listAdminTeachersService = async () => ({ teachers: await listTeachers() });
