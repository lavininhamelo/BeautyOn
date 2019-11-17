import { Router } from 'express';
import UserController from './app/Controllers/UserController';
import SessionController from './app/Controllers/SessionController';
import authMiddlewares from './app/Middlewares/auth';

const routes = new Router();

routes.post('/sessions', SessionController.store);
routes.post('/users', UserController.store);

// Router Authorization
routes.use(authMiddlewares);

routes.put('/users', UserController.update);

export default routes;
