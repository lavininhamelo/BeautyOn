import React from 'react';
import { Switch, Redirect } from 'react-router-dom';

import Route from './Route';

import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import ClaimAccount from '../pages/ClaimAccount';

import Dashboard from '../pages/Dashboard/index';
import ProviderServices from '../pages/ProviderServices/index';
import ProviderBookForClient from '../pages/ProviderBookForClient/index';
import ProviderClients from '../pages/ProviderClients/index';
import ProviderClientHistory from '../pages/ProviderClientHistory/index';
import ProviderClientTimeline from '../pages/ProviderClientTimeline/index';
import ProviderAppointmentRecord from '../pages/ProviderAppointmentRecord/index';
import ProviderSchedule from '../pages/ProviderSchedule/index';
import ClientHome from '../pages/ClientHome/index';
import ClientAppointments from '../pages/ClientAppointments/index';
import Booking from '../pages/Booking/index';

import Profile from '../pages/Profile';

const SignUpClientPage: React.FC = () => (
  <SignUp registerAsProvider={false} />
);
const SignUpProviderPage: React.FC = () => (
  <SignUp registerAsProvider />
);

const Routes: React.FunctionComponent = () => (
  <Switch>
    <Route path="/" exact component={SignIn} />
    <Route path="/signup/provider" exact component={SignUpProviderPage} />
    <Route path="/signup" exact component={SignUpClientPage} />
    <Route path="/forgot-password" component={ForgotPassword} />
    <Route path="/reset-password" component={ResetPassword} />
    <Route path="/claim" exact component={ClaimAccount} />

    <Route
      path="/book/:providerId"
      component={Booking}
      skipRedirectIfAuthenticated
    />
    <Route
      path="/book"
      exact
      component={Booking}
      skipRedirectIfAuthenticated
    />

    <Route
      exact
      path="/provider/schedule"
      component={ProviderSchedule}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/services"
      component={ProviderServices}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/appointments/:appointmentId/record"
      component={ProviderAppointmentRecord}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/book"
      component={ProviderBookForClient}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/clients"
      component={ProviderClients}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/clients/:clientId/history"
      component={ProviderClientHistory}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/clients/:clientId/timeline"
      component={ProviderClientTimeline}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider"
      component={Dashboard}
      isPrivate
      accessRole="provider"
    />
    <Route
      exact
      path="/provider/reschedule/:appointmentId"
      component={Booking}
      isPrivate
      accessRole="provider"
    />
    <Route path="/client" exact component={ClientHome} isPrivate accessRole="client" />
    <Route
      path="/client/appointments"
      component={ClientAppointments}
      isPrivate
      accessRole="client"
    />
    <Route
      exact
      path="/client/reschedule/:appointmentId"
      component={Booking}
      isPrivate
      accessRole="client"
    />
    <Route
      path="/client/book/:providerId"
      component={Booking}
      isPrivate
      accessRole="client"
    />

    <Route path="/profile" component={Profile} isPrivate />

    <Redirect exact from="/dashboard" to="/provider" />
  </Switch>
);

export default Routes;
