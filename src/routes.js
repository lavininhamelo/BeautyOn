import { Router } from 'express';
import multer from 'multer';
import UserController from './app/Controllers/UserController';
import SessionController from './app/Controllers/SessionController';
import FileController from './app/Controllers/FileController';
import ProviderController from './app/Controllers/ProviderController';
import AppointmentController from './app/Controllers/AppointmentController';
import ScheduleController from './app/Controllers/ScheduleController';
import NotificationController from './app/Controllers/NotificationController';
import multerConfig from './config/multer';

import authMiddleware from './app/Middlewares/auth';

const routes = new Router();
const upload = multer(multerConfig);

routes.post('/users', UserController.store);
routes.post('/sessions', SessionController.store);

routes.use(authMiddleware);

routes.put('/users', UserController.update);

routes.get('/providers', ProviderController.index);

routes.get('/appointments', AppointmentController.index);
routes.post('/appointments', AppointmentController.store);

routes.get('/schedule', ScheduleController.index);

routes.get('/notifications', NotificationController.index);
routes.put('/notifications/:id', NotificationController.update);

routes.post('/files', upload.single('file'), FileController.store);

export default routes;
