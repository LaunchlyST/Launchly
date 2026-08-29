import React from 'react';
import { Tool } from '../../shared/types';

interface ToolRailProps {
  tools: Tool[];
  activeTool: string;
  onToolChange: (tool: string) => void;
  openPanels: Record<string, boolean>;
  onPanelToggle: (panels: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  media: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="m9 9 5 3-5 3V9Z" />
    </>
  ),
  text: (
    <>
      <path d="M5 6h14" />
      <path d="M12 6v12" />
      <path d="M8.5 18h7" />
    </>
  ),
  captions: (
    <>
      <path d="M5 6.5h14v9H9l-4 3v-12Z" />
      <path d="M8 10h4" />
      <path d="M8 13h8" />
    </>
  ),
  audio: (
    <>
      <path d="M6 14h3l4 4V6l-4 4H6v4Z" />
      <path d="M16 9.5a4 4 0 0 1 0 5" />
      <path d="M18.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  brand: (
    <>
      <path d="M12 4 19 8v8l-7 4-7-4V8l7-4Z" />
      <path d="M9 10.5h6" />
      <path d="M9 13.5h4" />
    </>
  ),
  templates: (
    <>
      <path d="M5 5h6v6H5V5Z" />
      <path d="M13 5h6v6h-6V5Z" />
      <path d="M5 13h6v6H5v-6Z" />
      <path d="M13 13h6v6h-6v-6Z" />
    </>
  ),
  effects: (
    <>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m6.5 6.5 2.8 2.8" />
      <path d="m14.7 14.7 2.8 2.8" />
      <path d="m17.5 6.5-2.8 2.8" />
      <path d="m9.3 14.7-2.8 2.8" />
    </>
  ),
  transitions: (
    <>
      <path d="M4 7h7v10H4V7Z" />
      <path d="M13 7h7v10h-7V7Z" />
      <path d="m10 12 4-3v6l-4-3Z" />
    </>
  ),
  'ai-tools': (
    <>
      <path d="M12 4 14 9l5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" />
      <path d="M18 4v3" />
      <path d="M16.5 5.5h3" />
    </>
  ),
};

export function ToolRail({ tools, activeTool, onToolChange, openPanels, onPanelToggle }: ToolRailProps) {
  return (
    <aside className="tool-rail glass-panel" aria-label="Creation tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`tool ${activeTool === tool.id ? 'active' : ''} ${tool.ai ? 'ai-tool' : ''}`}
          aria-label={tool.label}
          data-label={tool.label}
          data-panel-copy={tool.id === 'ai-tools' ? 'Explore local smart-edit workflows, pacing ideas, caption cleanup, and scene suggestions.' : ''}
          onClick={() => {
            onToolChange(tool.id);
            onPanelToggle((prev) => ({ ...prev, [tool.id]: !prev[tool.id] }));
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {TOOL_ICONS[tool.id]}
          </svg>
          <span>{tool.label}</span>
        </button>
      ))}
      <div className="tool-divider" />
    </aside>
  );
}