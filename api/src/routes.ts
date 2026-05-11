import { Router } from 'express';
import multer from 'multer';
import multerConfig from './config/multer.js';

import UserController from './app/Controllers/UserController.js';
import SessionController from './app/Controllers/SessionController.js';
import PasswordController from './app/Controllers/PasswordController.js';
import FileController from './app/Controllers/FileController.js';
import ProviderController from './app/Controllers/ProviderController.js';
import AppointmentController from './app/Controllers/AppointmentController.js';
import ClientClaimController from './app/Controllers/ClientClaimController.js';
import NotificationController from './app/Controllers/NotificationController.js';
import AvailableController from './app/Controllers/AvailableController.js';
import ProviderServiceController from './app/Controllers/ProviderServiceController.js';
import ProviderClientController from './app/Controllers/ProviderClientController.js';
import AppointmentRecordController, { recordUpload } from './app/Controllers/AppointmentRecordController.js';
import ProviderScheduleConfigController from './app/Controllers/ProviderScheduleConfigController.js';

import authMiddleware from './app/Middlewares/auth.js';
import ScheduleController from './app/Controllers/ScheduleController.js';

const routes = Router();
const upload = multer(multerConfig);

routes.post('/users', UserController.store);
routes.post('/users/claim-request', ClientClaimController.request);
routes.post('/users/claim', ClientClaimController.claim);
routes.post('/sessions', SessionController.store);
routes.post('/password/forgot', PasswordController.forgot);
routes.post('/password/reset', PasswordController.reset);
routes.get('/health', (req, res) => {
  return res.json({ status: 'ok' });
});

routes.get(
  '/providers/:providerId/services',
  ProviderServiceController.publicIndex.bind(ProviderServiceController),
);

routes.get('/providers', ProviderController.index);
routes.get(
  '/providers/:providerId/available',
  AvailableController.index,
);
routes.post(
  '/appointments/guest',
  AppointmentController.storeGuest.bind(AppointmentController),
);
routes.post(
  '/appointments/guest-lookup',
  AppointmentController.lookupGuestByPhone.bind(AppointmentController),
);

routes.use(authMiddleware);

routes.get('/profile', UserController.profile);
routes.post('/users/avatar', upload.single('avatar'), UserController.avatar);

routes.put('/users', UserController.update);

routes.get(
  '/appointments/me',
  AppointmentController.me.bind(AppointmentController),
);
routes.get('/appointments', AppointmentController.index);
routes.post(
  '/appointments',
  AppointmentController.store.bind(AppointmentController),
);
routes.delete('/appointments/:id', AppointmentController.delete);
routes.patch(
  '/appointments/:id/reschedule',
  AppointmentController.rescheduleSelf.bind(AppointmentController),
);

routes.get('/booking/eligibility', AppointmentController.eligibility);

routes.get('/schedule', ScheduleController.index);
routes.get(
  '/provider/schedule-config',
  ProviderScheduleConfigController.show.bind(ProviderScheduleConfigController),
);
routes.put(
  '/provider/schedule-config',
  ProviderScheduleConfigController.upsert.bind(ProviderScheduleConfigController),
);
routes.post(
  '/provider/appointments/for-client',
  AppointmentController.storeForClient.bind(AppointmentController),
);
routes.patch(
  '/provider/appointments/:id/status',
  AppointmentController.updateStatus.bind(AppointmentController),
);
routes.patch(
  '/provider/appointments/:id/reschedule',
  AppointmentController.reschedule.bind(AppointmentController),
);
routes.get(
  '/provider/appointments/:appointmentId/record',
  AppointmentRecordController.show.bind(AppointmentRecordController),
);
routes.post(
  '/provider/appointments/:appointmentId/record',
  recordUpload,
  AppointmentRecordController.upsert.bind(AppointmentRecordController),
);
routes.get(
  '/provider/services',
  ProviderServiceController.index.bind(ProviderServiceController),
);
routes.post(
  '/provider/services',
  ProviderServiceController.store.bind(ProviderServiceController),
);
routes.put(
  '/provider/services/:id',
  ProviderServiceController.update.bind(ProviderServiceController),
);
routes.delete(
  '/provider/services/:id',
  ProviderServiceController.destroy.bind(ProviderServiceController),
);
routes.get(
  '/provider/clients',
  ProviderClientController.index.bind(ProviderClientController),
);
routes.post(
  '/provider/clients/:id/clearance',
  ProviderClientController.grantClearance.bind(ProviderClientController),
);
routes.delete(
  '/provider/clients/:id/clearance',
  ProviderClientController.revokeClearance.bind(ProviderClientController),
);
routes.get(
  '/provider/clients/:id/appointments',
  ProviderClientController.appointments.bind(ProviderClientController),
);
routes.get(
  '/provider/clients/:id/timeline',
  ProviderClientController.timeline.bind(ProviderClientController),
);
routes.post(
  '/provider/clients',
  ProviderClientController.store.bind(ProviderClientController),
);
routes.put(
  '/provider/clients/:id',
  ProviderClientController.update.bind(ProviderClientController),
);

routes.get('/notifications', NotificationController.index);
routes.put('/notifications/:id', NotificationController.update);

routes.post('/files', upload.single('file'), FileController.store);

export default routes;
