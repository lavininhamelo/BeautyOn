import React from 'react';
import { useHistory } from 'react-router-dom';

import { useAuth } from '../../hooks/auth';
import BookingWizard from '../../components/BookingWizard';
import { Modal } from '../../components/ui/modal';

const ProviderBookForClient: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();

  const onClose = () => history.push('/provider');

  return (
    <Modal
      open
      hideChrome
      onClose={onClose}
      panelClassName="w-full max-w-2xl sm:max-w-4xl"
    >
      <BookingWizard
        providerId={Number(user.id)}
        guestMode
        providerForClient
        presentation="modal"
        onRequestClose={onClose}
        hideProviderSwitcher
      />
    </Modal>
  );
};

export default ProviderBookForClient;
