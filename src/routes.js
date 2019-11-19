import { Router } from 'express';
import multer from 'multer';
import UserController from './app/Controllers/UserController';
import SessionController from './app/Controllers/SessionController';
import FileController from './app/Controllers/FileController';
import ProviderController from './app/Controllers/ProviderController';
import authMiddlewares from './app/Middlewares/auth';
import multerConfig from './config/multer';

const routes = new Router();
const upload = multer(multerConfig);

routes.post('/sessions', SessionController.store);
routes.post('/users', UserController.store);

// Router Authorization
routes.use(authMiddlewares);

routes.put('/users', UserController.update);
routes.get('/providers', ProviderController.index);
routes.post('/files', upload.single('file'), FileController.store);

export default routes;
