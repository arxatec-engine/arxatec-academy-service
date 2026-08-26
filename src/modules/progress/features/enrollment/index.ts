import { Router } from 'express';

import { createEnrollmentRouter } from '@/modules/progress/features/enrollment/create/presentation/create.routes';

export const enrollmentRouter: Router = Router();

enrollmentRouter.use(createEnrollmentRouter);
