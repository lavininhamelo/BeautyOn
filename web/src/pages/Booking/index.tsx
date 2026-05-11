import React, { useCallback } from 'react';
import { useParams, useLocation, Redirect, useHistory } from 'react-router-dom';

import ProviderPicker from '../../components/ProviderPicker';
import BookingWizard from './BookingWizard';
import { Modal } from '../../components/ui/modal';

interface RescheduleLocationState {
  providerId?: number;
  serviceId?: number;
  serviceName?: string;
}

const Booking: React.FC = () => {
  const history = useHistory();
  const { providerId, appointmentId } = useParams<{
    providerId?: string;
    appointmentId?: string;
  }>();
  const location = useLocation<RescheduleLocationState | undefined>();
  const { pathname } = location;

  const providerReschedule = pathname.startsWith('/provider/reschedule');
  const clientReschedule = pathname.startsWith('/client/reschedule');
  const isReschedule = providerReschedule || clientReschedule;

  const closeWizard = useCallback(() => {
    if (providerReschedule) history.push('/provider');
    else if (clientReschedule) history.push('/client/appointments');
    else if (pathname.startsWith('/client/book')) history.push('/client');
    else history.push('/book');
  }, [history, pathname, providerReschedule, clientReschedule]);

  if (isReschedule) {
    const apptId = Number(appointmentId);
    const ctxProviderId = location.state?.providerId;
    if (Number.isNaN(apptId) || !ctxProviderId) {
      return (
        <Redirect to={providerReschedule ? '/provider' : '/client/appointments'} />
      );
    }
    return (
      <Modal
        open
        hideChrome
        onClose={closeWizard}
        panelClassName="w-full max-w-2xl sm:max-w-4xl"
      >
        <BookingWizard
          providerId={ctxProviderId}
          guestMode={false}
          presentation="modal"
          onRequestClose={closeWizard}
          hideProviderSwitcher
          reschedule={{
            appointmentId: apptId,
            scope: providerReschedule ? 'provider' : 'client',
            serviceId: location.state?.serviceId,
            serviceName: location.state?.serviceName,
          }}
        />
      </Modal>
    );
  }

  const clientFlow = pathname.startsWith('/client/book');

  if (!providerId) {
    if (pathname !== '/book') {
      return <Redirect to="/client" />;
    }
    return (
      <ProviderPicker
        bookPath={id => `/book/${id}`}
        title="Agendar sem conta"
        backTo="/"
      />
    );
  }

  const idNum = Number(providerId);
  if (Number.isNaN(idNum)) {
    return <Redirect to={clientFlow ? '/client' : '/book'} />;
  }

  const hideProviderSwitcher = clientFlow && !!providerId;

  return (
    <Modal
      open
      hideChrome
      onClose={closeWizard}
      panelClassName="w-full max-w-2xl sm:max-w-4xl"
    >
      <BookingWizard
        providerId={idNum}
        guestMode={!clientFlow}
        presentation="modal"
        onRequestClose={closeWizard}
        hideProviderSwitcher={hideProviderSwitcher}
      />
    </Modal>
  );
};

export default Booking;
