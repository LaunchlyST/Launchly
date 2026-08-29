import React, { forwardRef, useState, useMemo } from 'react';
import { glassmorphismStyles, theme } from '../../shared/styles/theme';

export interface ToolsPanelProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  tracks: any[];
  onAddTrack: (type: string) => void;
  onAddClip: (trackId: string, clip: any) => void;
  availableAssets: any[];
}

export const ToolsPanel = forwardRef<HTMLDivElement, ToolsPanelProps>(
  ({ activeTool, onToolChange, tracks, onAddTrack, onAddClip, availableAssets }, ref) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
      tools: true,
      media: true,
      audio: true,
      effects: true,
      text: true,
    });

    const tools = useMemo(() => [
      { id: 'select', name: 'Select', icon: 'select', shortcut: 'V' },
      { id: 'blade', name: 'Blade', icon: 'blade', shortcut: 'B' },
      { id: 'hand', name: 'Hand', icon: 'hand', shortcut: 'H' },
      { id: 'zoom', name: 'Zoom', icon: 'zoom', shortcut: 'Z' },
      { id: 'pen', name: 'Pen', icon: 'pen', shortcut: 'P' },
      { id: 'text', name: 'Text', icon: 'text', shortcut: 'T' },
      { id: 'shape', name: 'Shape', icon: 'shape', shortcut: 'U' },
    ], []);

    const toolIcons: Record<string, React.ReactNode> = {
      select: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M14 9l-5 5-3-3-5 5" /></svg>,
      blade: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2L21 8.5l-7 7L3 18v-4l7-7L14.5 2z" /></svg>,
      hand: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0m2 10v6a2 2 0 0 0 2 2a2 2 0 0 0 2-2v0m-10 0v6a2 2 0 0 0 2 2a2 2 0 0 0 2-2v0" /></svg>,
      zoom: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
      pen: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>,
      text: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>,
      shape: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>,
    };

    const toggleSection = (section: string) => {
      setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
      <div ref={ref} className="tools-panel" style={glassmorphismStyles.toolsPanel}>
        <div className="panel-header" style={glassmorphismStyles.panelHeader}>
          <h2 style={glassmorphismStyles.panelTitle}>Tools</h2>
          <div className="panel-actions" style={glassmorphismStyles.panelActions}>
            <button className="icon-btn" style={glassmorphismStyles.iconButton} aria-label="Search tools">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button className="icon-btn" style={glassmorphismStyles.iconButton} aria-label="Tool settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="panel-content" style={glassmorphismStyles.panelContent}>
          <section className="panel-section" style={glassmorphismStyles.panelSection}>
            <button
              className="section-header"
              onClick={() => toggleSection('tools')}
              style={glassmorphismStyles.sectionHeader}
              aria-expanded={expandedSections.tools}
            >
              <span style={glassmorphismStyles.sectionTitle}>Editing Tools</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
                ...glassmorphismStyles.sectionIcon,
                transform: expandedSections.tools ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expandedSections.tools && (
              <div className="tools-grid" style={glassmorphismStyles.toolsGrid}>
                {tools.map(tool => (
                  <button
                    key={tool.id}
                    className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                    onClick={() => onToolChange(tool.id)}
                    style={{
                      ...glassmorphismStyles.toolButton,
                      ...(activeTool === tool.id ? glassmorphismStyles.toolButtonActive : {}),
                    }}
                    aria-pressed={activeTool === tool.id}
                    aria-label={`${tool.name} (${tool.shortcut})`}
                    title={`${tool.name} (${tool.shortcut})`}
                  >
                    <span className="tool-icon" style={glassmorphismStyles.toolIcon}>
                      {toolIcons[tool.icon]}
                    </span>
                    <span className="tool-name" style={glassmorphismStyles.toolName}>{tool.name}</span>
                    <span className="tool-shortcut" style={glassmorphismStyles.toolShortcut}>{tool.shortcut}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel-section" style={glassmorphismStyles.panelSection}>
            <button
              className="section-header"
              onClick={() => toggleSection('media')}
              style={glassmorphismStyles.sectionHeader}
              aria-expanded={expandedSections.media}
            >
              <span style={glassmorphismStyles.sectionTitle}>Media</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
                ...glassmorphismStyles.sectionIcon,
                transform: expandedSections.media ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expandedSections.media && (
              <div className="media-browser" style={glassmorphismStyles.mediaBrowser}>
                <div className="media-tabs" style={glassmorphismStyles.mediaTabs}>
                  {['All', 'Video', 'Audio', 'Images', 'Graphics'].map(tab => (
                    <button
                      key={tab}
                      className="media-tab"
                      style={glassmorphismStyles.mediaTab}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="media-grid" style={glassmorphismStyles.mediaGrid}>
                  {availableAssets.slice(0, 12).map((asset, index) => (
                    <div
                      key={asset.id || index}
                      className="media-item"
                      style={glassmorphismStyles.mediaItem}
                      onClick={() => onAddClip(tracks[0]?.id, asset)}
                      draggable
                    >
                      <div className="media-thumb" style={glassmorphismStyles.mediaThumb}>
                        {asset.thumbnail ? (
                          <img src={asset.thumbnail} alt="" style={glassmorphismStyles.thumbImage} />
                        ) : (
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                            <line x1="7" y1="2" x2="7" y2="22" />
                            <line x1="17" y1="2" x2="17" y2="22" />
                            <line x1="2" y1="7" x2="22" y2="7" />
                            <line x1="2" y1="17" x2="22" y2="17" />
                          </svg>
                        )}
                        <div className="media-duration" style={glassmorphismStyles.mediaDuration}>
                          {asset.duration || '0:00'}
                        </div>
                      </div>
                      <div className="media-info" style={glassmorphismStyles.mediaInfo}>
                        <span className="media-name" style={glassmorphismStyles.mediaName}>
                          {asset.name || `Asset ${index + 1}`}
                        </span>
                        <span className="media-type" style={glassmorphismStyles.mediaType}>
                          {asset.type || 'video'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {availableAssets.length === 0 && (
                    <div className="media-empty" style={glassmorphismStyles.mediaEmpty}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                        <line x1="7" y1="2" x2="7" y2="22" />
                        <line x1="17" y1="2" x2="17" y2="22" />
                        <line x1="2" y1="7" x2="22" y2="7" />
                        <line x1="2" y1="17" x2="22" y2="17" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      <p style={glassmorphismStyles.emptyText}>No media imported</p>
                      <button className="import-btn" style={glassmorphismStyles.importButton}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Import Media
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="panel-section" style={glassmorphismStyles.panelSection}>
            <button
              className="section-header"
              onClick={() => toggleSection('audio')}
              style={glassmorphismStyles.sectionHeader}
              aria-expanded={expandedSections.audio}
            >
              <span style={glassmorphismStyles.sectionTitle}>Audio</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
                ...glassmorphismStyles.sectionIcon,
                transform: expandedSections.audio ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expandedSections.audio && (
              <div className="audio-tools" style={glassmorphismStyles.audioTools}>
                <div className="audio-meter" style={glassmorphismStyles.audioMeter}>
                  <div className="meter-label" style={glassmorphismStyles.meterLabel}>Master</div>
                  <div className="meter-bar" style={glassmorphismStyles.meterBar}>
                    <div className="meter-level" style={{ ...glassmorphismStyles.meterLevel, width: '45%' }} />
                  </div>
                  <div className="meter-value" style={glassmorphismStyles.meterValue}>-12 dB</div>
                </div>
                <div className="audio-controls" style={glassmorphismStyles.audioControls}>
                  <label className="audio-control" style={glassmorphismStyles.audioControl}>
                    <span style={glassmorphismStyles.controlLabel}>Volume</span>
                    <input type="range" min="0" max="100" value={80} style={glassmorphismStyles.controlSlider} />
                    <span style={glassmorphismStyles.controlValue}>80%</span>
                  </label>
                  <label className="audio-control" style={glassmorphismStyles.audioControl}>
                    <span style={glassmorphismStyles.controlLabel}>Pan</span>
                    <input type="range" min="-100" max="100" value={0} style={glassmorphismStyles.controlSlider} />
                    <span style={glassmorphismStyles.controlValue}>C</span>
                  </label>
                </div>
                <div className="audio-effects" style={glassmorphismStyles.audioEffects}>
                  <span style={glassmorphismStyles.effectsLabel}>Quick Effects</span>
                  <div className="effect-chips" style={glassmorphismStyles.effectChips}>
                    {['Noise Reduction', 'Voice Enhance', 'Compressor', 'Limiter', 'EQ'].map(effect => (
                      <button key={effect} className="effect-chip" style={glassmorphismStyles.effectChip}>
                        {effect}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel-section" style={glassmorphismStyles.panelSection}>
            <button
              className="section-header"
              onClick={() => toggleSection('effects')}
              style={glassmorphismStyles.sectionHeader}
              aria-expanded={expandedSections.effects}
            >
              <span style={glassmorphismStyles.sectionTitle}>Effects</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
                ...glassmorphismStyles.sectionIcon,
                transform: expandedSections.effects ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expandedSections.effects && (
              <div className="effects-browser" style={glassmorphismStyles.effectsBrowser}>
                <div className="effect-categories" style={glassmorphismStyles.effectCategories}>
                  {['Color', 'Blur', 'Distort', 'Stylize', 'Transition', 'Utility'].map(cat => (
                    <button key={cat} className="effect-category" style={glassmorphismStyles.effectCategory}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="effects-list" style={glassmorphismStyles.effectsList}>
                  {[
                    'Color Grade', 'Gaussian Blur', 'Motion Blur', 'Glow', 'Vignette',
                    'Film Grain', 'Chromatic Aberration', 'RGB Split', 'LUT', 'Sharpen'
                  ].map(effect => (
                    <button key={effect} className="effect-item" style={glassmorphismStyles.effectItem}>
                      <span style={glassmorphismStyles.effectName}>{effect}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel-section" style={glassmorphismStyles.panelSection}>
            <button
              className="section-header"
              onClick={() => toggleSection('text')}
              style={glassmorphismStyles.sectionHeader}
              aria-expanded={expandedSections.text}
            >
              <span style={glassmorphismStyles.sectionTitle}>Text & Titles</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
                ...glassmorphismStyles.sectionIcon,
                transform: expandedSections.text ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {expandedSections.text && (
              <div className="text-templates" style={glassmorphismStyles.textTemplates}>
                {[
                  { name: 'Title', icon: 'T', style: 'Large headline text' },
                  { name: 'Subtitle', icon: 'T', style: 'Secondary text' },
                  { name: 'Lower Third', icon: 'T', style: 'Name/title overlay' },
                  { name: 'Caption', icon: 'T', style: 'Timed captions' },
                  { name: 'Credits', icon: 'T', style: 'Scrolling credits' },
                  { name: 'Kinetic', icon: 'T', style: 'Animated typography' },
                ].map(template => (
                  <button key={template.name} className="template-card" style={glassmorphismStyles.templateCard}>
                    <div className="template-icon" style={glassmorphismStyles.templateIcon}>{template.icon}</div>
                    <div className="template-info" style={glassmorphismStyles.templateInfo}>
                      <span className="template-name" style={glassmorphismStyles.templateName}>{template.name}</span>
                      <span className="template-desc" style={glassmorphismStyles.templateDesc}>{template.style}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }
);

ToolsPanel.displayName = 'ToolsPanel';