import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '../editor-state/editorStore';

export function ContextMenu() {
  const { contextMenu, setContextMenu } = useEditorStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleClick);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('contextmenu', handleClick);
      };
    }
  }, [contextMenu.visible, setContextMenu]);

  if (!contextMenu.visible) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu glass-panel"
      style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
    >
      {contextMenu.items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="context-menu-divider" />;
        }
        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.action?.();
              setContextMenu(null);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
