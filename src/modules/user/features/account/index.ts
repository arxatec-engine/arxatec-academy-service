import { Router } from 'express';

import { deleteAccountRouter } from '@/modules/user/features/account/delete/presentation/delete.routes';
import { getSummaryRouter } from '@/modules/user/features/account/get_summary/presentation/get_summary.routes';

export const accountRouter: Router = Router();

accountRouter.use(getSummaryRouter);
accountRouter.use(deleteAccountRouter);
