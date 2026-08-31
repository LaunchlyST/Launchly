import React from 'react';

interface MediaHeaderProps {
  count: number;
}

/** Section label plus item counter for the media library. */
export function MediaHeader({ count }: MediaHeaderProps) {
  return (
    <div className="media-panel__header">
      <h2 className="media-panel__title">Media</h2>
      <span className="media-panel__count-pill" aria-label={`${count} items`}>
        {count}
      </span>
    </div>
  );
}
