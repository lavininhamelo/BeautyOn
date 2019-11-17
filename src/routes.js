import { Router } from 'express';
import UserController from './app/Controllers/UserController';
import SessionController from './app/Controllers/SessionController';

const routes = new Router();

routes.post('/sessions', SessionController.store);
routes.post('/users', UserController.store);

export default routes;
