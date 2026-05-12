import React, { useMemo } from 'react';
import {
  Navigate,
  ToolbarProps,
  View,
} from 'react-big-calendar';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import clsx from 'clsx';

function viewsToNameList(views: ToolbarProps['views']): View[] {
  if (Array.isArray(views)) return views;
  if (views && typeof views === 'object') {
    return (Object.keys(views) as View[]).filter(
      key => Boolean((views as Record<string, unknown>)[key]),
    );
  }
  return [];
}

const ProviderCalendarToolbar: React.FC<ToolbarProps> = ({
  localizer,
  label,
  onNavigate,
  onView,
  view,
  views,
}) => {
  const messages = localizer.messages as Record<string, string>;
  const viewNames = useMemo(() => viewsToNameList(views), [views]);

  return (
    <div className="rbc-toolbar beautyon-rbc-toolbar">
      <span className="rbc-toolbar-label beautyon-rbc-label">{label}</span>
      <span className="rbc-btn-group beautyon-rbc-nav">
        <button type="button" onClick={() => onNavigate(Navigate.TODAY)}>
          {messages.today}
        </button>
        <button
          type="button"
          className="beautyon-rbc-icon-btn"
          aria-label={messages.previous}
          title={messages.previous}
          onClick={() => onNavigate(Navigate.PREVIOUS)}
        >
          <FiChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          className="beautyon-rbc-icon-btn"
          aria-label={messages.next}
          title={messages.next}
          onClick={() => onNavigate(Navigate.NEXT)}
        >
          <FiChevronRight className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </span>

      {viewNames.length > 1 && (
        <span className="rbc-btn-group beautyon-rbc-views">
          {viewNames.map(name => (
            <button
              key={name}
              type="button"
              className={clsx(view === name && 'rbc-active')}
              onClick={() => onView(name)}
            >
              {messages[name]}
            </button>
          ))}
        </span>
      )}
    </div>
  );
};

export default ProviderCalendarToolbar;
