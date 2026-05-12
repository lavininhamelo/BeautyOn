import React from 'react';
import { useTransition } from 'react-spring';
import Toast from './Toast';
import { ToastMessage } from '../../hooks/toast';

interface ToastContainerProps {
  messages: ToastMessage[];
}
const ToastContainer: React.FunctionComponent<ToastContainerProps> = ({
  messages,
}) => {
  const messagesWithTransitions = useTransition(
    messages,
    message => message.id,
    {
      from: { right: '-120%', opacity: 0 },
      enter: { right: '0%', opacity: 1 },
      leave: { right: '-120%', opacity: 0 },
    },
  );
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-[90] overflow-visible p-[1.875rem]">
      {messagesWithTransitions.map(({ item, key, props }) => (
        <Toast key={key} style={props} message={item} />
      ))}
    </div>
  );
};

export default ToastContainer;
