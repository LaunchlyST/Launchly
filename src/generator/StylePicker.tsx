import React from 'react';
import { Camera, Palette } from 'lucide-react';
import { StyleType } from '../store';

interface StylePickerProps {
  value: StyleType;
  onChange: (s: StyleType) => void;
}

export function StylePicker({ value, onChange }: StylePickerProps) {
  const options: { id: StyleType; label: string; icon: React.ReactNode }[] = [
    { id: 'realistic', label: 'Realistic', icon: <Camera size={18} /> },
    { id: 'cartoon', label: 'Cartoon', icon: <Palette size={18} /> },
  ];

  return (
    <div className="picker-group">
      <label className="picker-label">Style</label>
      <div className="picker-row">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`style-btn ${value === o.id ? 'is-selected' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
