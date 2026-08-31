import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';

interface AttachmentButtonProps {
  onAttach: (files: FileList | null) => void;
  disabled?: boolean;
  count?: number;
}

/** Attach control for the prompt composer. Owns its own hidden file input. */
export function AttachmentButton({ onAttach, disabled, count = 0 }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="composer-pill"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Attach a file"
      >
        <Paperclip size={13} strokeWidth={2} />
        <span>Attach</span>
        {count > 0 && <span className="composer-pill__badge">{count}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        multiple
        hidden
        onChange={(e) => {
          onAttach(e.target.files);
          if (e.target) e.target.value = '';
        }}
      />
    </>
  );
}
