import React from 'react';

interface EditorLayoutProps {
  leftPanel: React.ReactNode;
  preview: React.ReactNode;
  toolbar: React.ReactNode;
  timeline: React.ReactNode;
}

export function EditorLayout({ leftPanel, preview, toolbar, timeline }: EditorLayoutProps) {
  return (
    <div className="launchly-editor">
      <div className="launchly-editor__main">
        <aside className="launchly-editor__left">{leftPanel}</aside>
        <div className="launchly-editor__center">
          <div className="launchly-editor__preview-area">{preview}</div>
          <div className="launchly-editor__toolbar-area">{toolbar}</div>
          <div className="launchly-editor__timeline-area">{timeline}</div>
        </div>
      </div>
    </div>
  );
}
