import React from 'react';
import { useEditorStore } from '../editor-state/editorStore';
import { UploadIcon } from '../icons/Icon';

export function TopNav() {
  const { currentPage, setCurrentPage, uploadSubPage, setUploadSubPage } = useEditorStore() as any;
  if (currentPage !== 'upload') return null;

  return (
    <nav className="topnav">
      <div className="topnav__brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        <span className="topnav__name">Launchly</span>
      </div>
      <div className="topnav__tabs">
        <button
          className={`topnav__tab ${uploadSubPage === 'upload-project' ? 'is-active' : ''}`}
          onClick={() => { setCurrentPage('upload'); setUploadSubPage('upload-project'); }}
        >
          <UploadIcon size={15} />
          Upload Project
        </button>
        <button
          className={`topnav__tab ${uploadSubPage === 'selling' ? 'is-active' : ''}`}
          onClick={() => { setCurrentPage('upload'); setUploadSubPage('selling'); }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Selling
        </button>
      </div>
      <button className="topnav__back" onClick={() => setCurrentPage('editor')}>
        ← Back to editor
      </button>
    </nav>
  );
}
