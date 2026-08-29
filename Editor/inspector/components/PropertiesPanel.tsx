import React, { forwardRef, useState, useMemo } from 'react';
import { glassmorphismStyles, theme } from '../../shared/styles/theme';

export interface PropertiesPanelProps {
  selectedClipIds: string[];
  clips: any[];
  tracks: any[];
  projectSettings: any;
  onClipUpdate: (clipId: string, updates: any) => void;
  onTrackUpdate: (trackId: string, updates: any) => void;
  onProjectSettingsChange: (settings: any) => void;
  availableEffects: any[];
  availableTransitions: any[];
  availableFonts: string[];
}

export const PropertiesPanel = forwardRef<HTMLDivElement, PropertiesPanelProps>(
  ({
    selectedClipIds,
    clips,
    tracks,
    projectSettings,
    onClipUpdate,
    onTrackUpdate,
    onProjectSettingsChange,
    availableEffects,
    availableTransitions,
    availableFonts,
  }, ref) => {
    const [activeTab, setActiveTab] = useState<'clip' | 'track' | 'project' | 'effects'>('clip');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
      transform: true,
      opacity: true,
      speed: true,
      color: true,
      audio: true,
      effects: true,
      text: true,
    });

    const selectedClips = clips.filter(c => selectedClipIds.includes(c.id));
    const selectedClip = selectedClips[0];
    const selectedTrack = selectedClip ? tracks.find(t => t.id === selectedClip.trackId) : null;

    const toggleSection = (section: string) => {
      setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    if (selectedClipIds.length === 0) {
      return (
        <div ref={ref} className="properties-panel" style={glassmorphismStyles.propertiesPanel}>
          <div className="panel-header" style={glassmorphismStyles.panelHeader}>
            <h2 style={glassmorphismStyles.panelTitle}>Properties</h2>
          </div>
          <div className="panel-content" style={glassmorphismStyles.panelContent}>
            <div className="properties-empty" style={glassmorphismStyles.propertiesEmpty}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h3 style={glassmorphismStyles.emptyTitle}>No Selection</h3>
              <p style={glassmorphismStyles.emptyText}>
                Select a clip, track, or click the project tab to edit project settings.
              </p>
              <div className="tab-bar" style={glassmorphismStyles.tabBar} role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === 'project'}
                  onClick={() => setActiveTab('project')}
                  style={{
                    ...glassmorphismStyles.tabButton,
                    ...(activeTab === 'project' ? glassmorphismStyles.tabButtonActive : {}),
                  }}
                >
                  Project Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const renderTransformSection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('transform')}
          style={glassmorphismStyles.sectionToggle}
          aria-expanded={expandedSections.transform}
        >
          <span style={glassmorphismStyles.sectionTitle}>Transform</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
            ...glassmorphismStyles.sectionIcon,
            transform: expandedSections.transform ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedSections.transform && (
          <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
            {[
              { key: 'positionX', label: 'Position X', value: selectedClip.positionX || 0, unit: '%', min: -100, max: 100, step: 0.1 },
              { key: 'positionY', label: 'Position Y', value: selectedClip.positionY || 0, unit: '%', min: -100, max: 100, step: 0.1 },
              { key: 'scale', label: 'Scale', value: selectedClip.scale || 100, unit: '%', min: 10, max: 500, step: 1 },
              { key: 'rotation', label: 'Rotation', value: selectedClip.rotation || 0, unit: '°', min: -180, max: 180, step: 1 },
              { key: 'anchorX', label: 'Anchor X', value: selectedClip.anchorX || 50, unit: '%', min: 0, max: 100, step: 1 },
              { key: 'anchorY', label: 'Anchor Y', value: selectedClip.anchorY || 50, unit: '%', min: 0, max: 100, step: 1 },
            ].map(prop => (
              <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                  <input
                    type="number"
                    value={prop.value}
                    onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                    min={prop.min}
                    max={prop.max}
                    step={prop.step}
                    style={glassmorphismStyles.numberInput}
                  />
                  <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                </div>
                <input
                  type="range"
                  min={prop.min}
                  max={prop.max}
                  step={prop.step}
                  value={prop.value}
                  onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                  style={glassmorphismStyles.propertySlider}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    );

    const renderOpacitySection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('opacity')}
          style={glassmorphismStyles.sectionToggle}
          aria-expanded={expandedSections.opacity}
        >
          <span style={glassmorphismStyles.sectionTitle}>Opacity & Blend</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
            ...glassmorphismStyles.sectionIcon,
            transform: expandedSections.opacity ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedSections.opacity && (
          <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
            {[
              { key: 'opacity', label: 'Opacity', value: selectedClip.opacity || 100, unit: '%', min: 0, max: 100, step: 1 },
              { key: 'blendMode', label: 'Blend Mode', value: selectedClip.blendMode || 'normal', type: 'select', options: ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion'] },
            ].map(prop => (
              <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                {prop.type === 'select' ? (
                  <select
                    value={prop.value}
                    onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: e.target.value })}
                    style={glassmorphismStyles.selectInput}
                  >
                    {prop.options!.map(opt => (
                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                      <input
                        type="number"
                        value={prop.value}
                        onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                        min={prop.min}
                        max={prop.max}
                        step={prop.step}
                        style={glassmorphismStyles.numberInput}
                      />
                      <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={prop.min}
                      max={prop.max}
                      step={prop.step}
                      value={prop.value}
                      onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                      style={glassmorphismStyles.propertySlider}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    );

    const renderSpeedSection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('speed')}
          style={glassmorphismStyles.sectionToggle}
          aria-expanded={expandedSections.speed}
        >
          <span style={glassmorphismStyles.sectionTitle}>Speed & Timing</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
            ...glassmorphismStyles.sectionIcon,
            transform: expandedSections.speed ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedSections.speed && (
          <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
            {[
              { key: 'speed', label: 'Speed', value: selectedClip.speed || 100, unit: '%', min: 1, max: 1000, step: 1 },
              { key: 'reverse', label: 'Reverse', value: selectedClip.reverse || false, type: 'boolean' },
              { key: 'frameRate', label: 'Frame Rate', value: selectedClip.frameRate || projectSettings.fps || 30, type: 'select', options: [24, 25, 30, 50, 60] },
            ].map(prop => (
              <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                {prop.type === 'boolean' ? (
                  <label className="toggle-switch" style={glassmorphismStyles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={prop.value}
                      onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: e.target.checked })}
                      style={glassmorphismStyles.toggleInput}
                    />
                    <span className="toggle-slider" style={glassmorphismStyles.toggleSlider} />
                  </label>
                ) : prop.type === 'select' ? (
                  <select
                    value={prop.value}
                    onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseInt(e.target.value) })}
                    style={glassmorphismStyles.selectInput}
                  >
                    {prop.options!.map(opt => (
                      <option key={opt} value={opt}>{opt}fps</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                      <input
                        type="number"
                        value={prop.value}
                        onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                        min={prop.min}
                        max={prop.max}
                        step={prop.step}
                        style={glassmorphismStyles.numberInput}
                      />
                      <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={prop.min}
                      max={prop.max}
                      step={prop.step}
                      value={prop.value}
                      onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                      style={glassmorphismStyles.propertySlider}
                    />
                  </>
                )}
              </div>
            ))}
            <div className="property-row" style={glassmorphismStyles.propertyRow}>
              <label style={glassmorphismStyles.propertyLabel}>Presets</label>
              <div className="speed-presets" style={glassmorphismStyles.speedPresets}>
                {[25, 50, 75, 100, 125, 150, 200, 400].map(preset => (
                  <button
                    key={preset}
                    onClick={() => onClipUpdate(selectedClip.id, { speed: preset })}
                    style={{
                      ...glassmorphismStyles.presetButton,
                      ...(selectedClip.speed === preset ? glassmorphismStyles.presetButtonActive : {}),
                    }}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    );

    const renderColorSection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('color')}
          style={glassmorphismStyles.sectionToggle}
          aria-expanded={expandedSections.color}
        >
          <span style={glassmorphismStyles.sectionTitle}>Color & Effects</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
            ...glassmorphismStyles.sectionIcon,
            transform: expandedSections.color ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedSections.color && (
          <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
            {[
              { key: 'brightness', label: 'Brightness', value: selectedClip.brightness || 0, unit: '%', min: -100, max: 100, step: 1 },
              { key: 'contrast', label: 'Contrast', value: selectedClip.contrast || 0, unit: '%', min: -100, max: 100, step: 1 },
              { key: 'saturation', label: 'Saturation', value: selectedClip.saturation || 0, unit: '%', min: -100, max: 100, step: 1 },
              { key: 'temperature', label: 'Temperature', value: selectedClip.temperature || 0, unit: '', min: -100, max: 100, step: 1 },
              { key: 'tint', label: 'Tint', value: selectedClip.tint || 0, unit: '', min: -100, max: 100, step: 1 },
              { key: 'exposure', label: 'Exposure', value: selectedClip.exposure || 0, unit: 'EV', min: -5, max: 5, step: 0.1 },
              { key: 'highlights', label: 'Highlights', value: selectedClip.highlights || 0, unit: '%', min: -100, max: 100, step: 1 },
              { key: 'shadows', label: 'Shadows', value: selectedClip.shadows || 0, unit: '%', min: -100, max: 100, step: 1 },
            ].map(prop => (
              <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                  <input
                    type="number"
                    value={prop.value}
                    onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                    min={prop.min}
                    max={prop.max}
                    step={prop.step}
                    style={glassmorphismStyles.numberInput}
                  />
                  <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                </div>
                <input
                  type="range"
                  min={prop.min}
                  max={prop.max}
                  step={prop.step}
                  value={prop.value}
                  onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                  style={glassmorphismStyles.propertySlider}
                />
              </div>
            ))}
            <div className="property-row" style={glassmorphismStyles.propertyRow}>
              <label style={glassmorphismStyles.propertyLabel}>LUT</label>
              <select
                value={selectedClip.lut || 'none'}
                onChange={(e) => onClipUpdate(selectedClip.id, { lut: e.target.value })}
                style={glassmorphismStyles.selectInput}
              >
                <option value="none">None</option>
                <option value="cinematic">Cinematic</option>
                <option value="teal-orange">Teal & Orange</option>
                <option value="bleach-bypass">Bleach Bypass</option>
                <option value="film">Film Emulation</option>
                <option value="vintage">Vintage</option>
                <option value="log">Log to Rec709</option>
              </select>
            </div>
          </div>
        )}
      </section>
    );

    const renderAudioSection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('audio')}
          style={glassmorphismStyles.sectionToggle}
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
          <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
            {[
              { key: 'volume', label: 'Volume', value: selectedClip.volume || 100, unit: '%', min: 0, max: 200, step: 1 },
              { key: 'pan', label: 'Pan', value: selectedClip.pan || 0, unit: '', min: -100, max: 100, step: 1 },
              { key: 'fadeIn', label: 'Fade In', value: selectedClip.fadeIn || 0, unit: 's', min: 0, max: 10, step: 0.1 },
              { key: 'fadeOut', label: 'Fade Out', value: selectedClip.fadeOut || 0, unit: 's', min: 0, max: 10, step: 0.1 },
              { key: 'pitch', label: 'Pitch', value: selectedClip.pitch || 0, unit: 'st', min: -12, max: 12, step: 0.5 },
            ].map(prop => (
              <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                  <input
                    type="number"
                    value={prop.value}
                    onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                    min={prop.min}
                    max={prop.max}
                    step={prop.step}
                    style={glassmorphismStyles.numberInput}
                  />
                  <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                </div>
                <input
                  type="range"
                  min={prop.min}
                  max={prop.max}
                  step={prop.step}
                  value={prop.value}
                  onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                  style={glassmorphismStyles.propertySlider}
                />
              </div>
            ))}
            <div className="property-row" style={glassmorphismStyles.propertyRow}>
              <label style={glassmorphismStyles.propertyLabel}>EQ Preset</label>
              <select
                value={selectedClip.eqPreset || 'flat'}
                onChange={(e) => onClipUpdate(selectedClip.id, { eqPreset: e.target.value })}
                style={glassmorphismStyles.selectInput}
              >
                <option value="flat">Flat</option>
                <option value="voice">Voice Enhance</option>
                <option value="music">Music</option>
                <option value="bass">Bass Boost</option>
                <option value="treble">Treble Boost</option>
                <option value="phone">Phone</option>
                <option value="radio">Radio</option>
              </select>
            </div>
          </div>
        )}
      </section>
    );

    const renderEffectsSection = () => (
      <section className="property-section" style={glassmorphismStyles.propertySection}>
        <button
          className="section-toggle"
          onClick={() => toggleSection('effects')}
          style={glassmorphismStyles.sectionToggle}
          aria-expanded={expandedSections.effects}
        >
          <span style={glassmorphismStyles.sectionTitle}>Applied Effects</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
            ...glassmorphismStyles.sectionIcon,
            transform: expandedSections.effects ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedSections.effects && (
          <div className="effects-stack" style={glassmorphismStyles.effectsStack}>
            {(selectedClip.effects || []).map((effect: any, index: number) => (
              <div key={effect.id || index} className="effect-row" style={glassmorphismStyles.effectRow}>
                <div className="effect-info" style={glassmorphismStyles.effectInfo}>
                  <span className="effect-name" style={glassmorphismStyles.effectName}>{effect.name}</span>
                  <span className="effect-params" style={glassmorphismStyles.effectParams}>
                    {Object.entries(effect.params || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </span>
                </div>
                <div className="effect-actions" style={glassmorphismStyles.effectActions}>
                  <label className="toggle-switch" style={glassmorphismStyles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={effect.enabled !== false}
                      onChange={(e) => {
                        const updated = [...(selectedClip.effects || [])];
                        updated[index] = { ...updated[index], enabled: e.target.checked };
                        onClipUpdate(selectedClip.id, { effects: updated });
                      }}
                      style={glassmorphismStyles.toggleInput}
                    />
                    <span className="toggle-slider" style={glassmorphismStyles.toggleSlider} />
                  </label>
                  <button
                    onClick={() => {
                      const updated = [...(selectedClip.effects || [])];
                      updated.splice(index, 1);
                      onClipUpdate(selectedClip.id, { effects: updated });
                    }}
                    style={glassmorphismStyles.effectRemoveBtn}
                    aria-label="Remove effect"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {(!selectedClip.effects || selectedClip.effects.length === 0) && (
              <div className="no-effects" style={glassmorphismStyles.noEffects}>
                <p style={glassmorphismStyles.noEffectsText}>No effects applied</p>
                <button className="add-effect-btn" style={glassmorphismStyles.addEffectButton}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Effect
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    );

    const renderTextSection = () => {
      if (selectedClip.type !== 'text') return null;
      return (
        <section className="property-section" style={glassmorphismStyles.propertySection}>
          <button
            className="section-toggle"
            onClick={() => toggleSection('text')}
            style={glassmorphismStyles.sectionToggle}
            aria-expanded={expandedSections.text}
          >
            <span style={glassmorphismStyles.sectionTitle}>Text</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
              ...glassmorphismStyles.sectionIcon,
              transform: expandedSections.text ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expandedSections.text && (
            <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Content</label>
                <textarea
                  value={selectedClip.text || ''}
                  onChange={(e) => onClipUpdate(selectedClip.id, { text: e.target.value })}
                  style={glassmorphismStyles.textArea}
                  rows={3}
                  placeholder="Enter text..."
                />
              </div>
              {[
                { key: 'fontFamily', label: 'Font', value: selectedClip.fontFamily || availableFonts[0] || 'Inter', type: 'font', options: availableFonts },
                { key: 'fontSize', label: 'Size', value: selectedClip.fontSize || 48, unit: 'px', min: 8, max: 300, step: 1 },
                { key: 'fontWeight', label: 'Weight', value: selectedClip.fontWeight || '600', type: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                { key: 'lineHeight', label: 'Line Height', value: selectedClip.lineHeight || 1.2, unit: '', min: 0.5, max: 3, step: 0.05 },
                { key: 'letterSpacing', label: 'Letter Spacing', value: selectedClip.letterSpacing || 0, unit: 'px', min: -5, max: 50, step: 0.5 },
              ].map(prop => (
                <div key={prop.key} className="property-row" style={glassmorphismStyles.propertyRow}>
                  <label style={glassmorphismStyles.propertyLabel}>{prop.label}</label>
                  {prop.type === 'font' ? (
                    <select
                      value={prop.value}
                      onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: e.target.value })}
                      style={glassmorphismStyles.selectInput}
                    >
                      {prop.options!.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                      ))}
                    </select>
                  ) : prop.type === 'select' ? (
                    <select
                      value={prop.value}
                      onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: e.target.value })}
                      style={glassmorphismStyles.selectInput}
                    >
                      {prop.options!.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                        <input
                          type="number"
                          value={prop.value}
                          onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                          min={prop.min}
                          max={prop.max}
                          step={prop.step}
                          style={glassmorphismStyles.numberInput}
                        />
                        <span style={glassmorphismStyles.propertyUnit}>{prop.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={prop.min}
                        max={prop.max}
                        step={prop.step}
                        value={prop.value}
                        onChange={(e) => onClipUpdate(selectedClip.id, { [prop.key]: parseFloat(e.target.value) })}
                        style={glassmorphismStyles.propertySlider}
                      />
                    </>
                  )}
                </div>
              ))}
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Color</label>
                <div className="color-picker-group" style={glassmorphismStyles.colorPickerGroup}>
                  <input
                    type="color"
                    value={selectedClip.color || '#ffffff'}
                    onChange={(e) => onClipUpdate(selectedClip.id, { color: e.target.value })}
                    style={glassmorphismStyles.colorInput}
                  />
                  <input
                    type="text"
                    value={selectedClip.color || '#ffffff'}
                    onChange={(e) => onClipUpdate(selectedClip.id, { color: e.target.value })}
                    style={glassmorphismStyles.colorTextInput}
                  />
                </div>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Alignment</label>
                <div className="alignment-buttons" style={glassmorphismStyles.alignmentButtons}>
                  {['left', 'center', 'right', 'justify'].map(align => (
                    <button
                      key={align}
                      onClick={() => onClipUpdate(selectedClip.id, { textAlign: align })}
                      style={{
                        ...glassmorphismStyles.alignButton,
                        ...(selectedClip.textAlign === align ? glassmorphismStyles.alignButtonActive : {}),
                      }}
                      aria-pressed={selectedClip.textAlign === align}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {align === 'left' && <line x1="3" y1="6" x2="15" y2="6" />}
                        {align === 'center' && <line x1="3" y1="12" x2="21" y2="12" />}
                        {align === 'right' && <line x1="9" y1="18" x2="21" y2="18" />}
                        {align === 'justify' && (
                          <>
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                          </>
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      );
    };

    const renderProjectSettings = () => (
      <div className="project-settings" style={glassmorphismStyles.projectSettings}>
        <section className="property-section" style={glassmorphismStyles.propertySection}>
          <button
            className="section-toggle"
            onClick={() => toggleSection('project')}
            style={glassmorphismStyles.sectionToggle}
            aria-expanded={expandedSections.project}
          >
            <span style={glassmorphismStyles.sectionTitle}>Project Settings</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
              ...glassmorphismStyles.sectionIcon,
              transform: expandedSections.project ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expandedSections.project && (
            <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Project Name</label>
                <input
                  type="text"
                  value={projectSettings.name || 'Untitled Project'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, name: e.target.value })}
                  style={glassmorphismStyles.textInput}
                />
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Resolution</label>
                <select
                  value={projectSettings.resolution || '1920x1080'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, resolution: e.target.value })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="3840x2160">4K (3840×2160)</option>
                  <option value="2560x1440">2K (2560×1440)</option>
                  <option value="1920x1080">Full HD (1920×1080)</option>
                  <option value="1280x720">HD (1280×720)</option>
                  <option value="1080x1920">Vertical 9:16 (1080×1920)</option>
                  <option value="1080x1080">Square 1:1 (1080×1080)</option>
                  <option value="custom">Custom...</option>
                </select>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Frame Rate</label>
                <select
                  value={projectSettings.fps || 30}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, fps: parseInt(e.target.value) })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="24">24 fps (Cinema)</option>
                  <option value="25">25 fps (PAL)</option>
                  <option value="30">30 fps (NTSC)</option>
                  <option value="50">50 fps</option>
                  <option value="60">60 fps</option>
                  <option value="120">120 fps</option>
                </select>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Color Space</label>
                <select
                  value={projectSettings.colorSpace || 'rec709'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, colorSpace: e.target.value })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="rec709">Rec. 709 (Standard)</option>
                  <option value="p3">Display P3</option>
                  <option value="rec2020">Rec. 2020</option>
                  <option value="aces">ACES</option>
                </select>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Background</label>
                <div className="color-picker-group" style={glassmorphismStyles.colorPickerGroup}>
                  <input
                    type="color"
                    value={projectSettings.backgroundColor || '#0a0d12'}
                    onChange={(e) => onProjectSettingsChange({ ...projectSettings, backgroundColor: e.target.value })}
                    style={glassmorphismStyles.colorInput}
                  />
                  <input
                    type="text"
                    value={projectSettings.backgroundColor || '#0a0d12'}
                    onChange={(e) => onProjectSettingsChange({ ...projectSettings, backgroundColor: e.target.value })}
                    style={glassmorphismStyles.colorTextInput}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="property-section" style={glassmorphismStyles.propertySection}>
          <button
            className="section-toggle"
            onClick={() => toggleSection('export')}
            style={glassmorphismStyles.sectionToggle}
            aria-expanded={expandedSections.export}
          >
            <span style={glassmorphismStyles.sectionTitle}>Export Defaults</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{
              ...glassmorphismStyles.sectionIcon,
              transform: expandedSections.export ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expandedSections.export && (
            <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Format</label>
                <select
                  value={projectSettings.exportFormat || 'mp4'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, exportFormat: e.target.value })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="mp4">MP4 (H.264)</option>
                  <option value="mov">MOV (ProRes)</option>
                  <option value="webm">WebM (VP9)</option>
                  <option value="gif">GIF</option>
                </select>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Codec</label>
                <select
                  value={projectSettings.codec || 'h264'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, codec: e.target.value })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="h264">H.264</option>
                  <option value="hevc">HEVC (H.265)</option>
                  <option value="prores">ProRes 422</option>
                  <option value="prores-hq">ProRes 422 HQ</option>
                  <option value="av1">AV1</option>
                </select>
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Bitrate</label>
                <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                  <input
                    type="number"
                    value={projectSettings.bitrate || 20}
                    onChange={(e) => onProjectSettingsChange({ ...projectSettings, bitrate: parseInt(e.target.value) })}
                    min={1}
                    max={500}
                    step={1}
                    style={glassmorphismStyles.numberInput}
                  />
                  <span style={glassmorphismStyles.propertyUnit}>Mbps</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="1"
                  value={projectSettings.bitrate || 20}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, bitrate: parseInt(e.target.value) })}
                  style={glassmorphismStyles.propertySlider}
                />
              </div>
              <div className="property-row" style={glassmorphismStyles.propertyRow}>
                <label style={glassmorphismStyles.propertyLabel}>Audio Codec</label>
                <select
                  value={projectSettings.audioCodec || 'aac'}
                  onChange={(e) => onProjectSettingsChange({ ...projectSettings, audioCodec: e.target.value })}
                  style={glassmorphismStyles.selectInput}
                >
                  <option value="aac">AAC</option>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV (PCM)</option>
                  <option value="flac">FLAC</option>
                  <option value="opus">Opus</option>
                </select>
              </div>
            </div>
          )}
        </section>
      </div>
    );

    return (
      <div ref={ref} className="properties-panel" style={glassmorphismStyles.propertiesPanel}>
        <div className="panel-header" style={glassmorphismStyles.panelHeader}>
          <div className="tab-bar" style={glassmorphismStyles.tabBar} role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'clip'}
              onClick={() => setActiveTab('clip')}
              style={{
                ...glassmorphismStyles.tabButton,
                ...(activeTab === 'clip' ? glassmorphismStyles.tabButtonActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
              Clip
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'track'}
              onClick={() => setActiveTab('track')}
              style={{
                ...glassmorphismStyles.tabButton,
                ...(activeTab === 'track' ? glassmorphismStyles.tabButtonActive : {}),
              }}
              disabled={!selectedTrack}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Track
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'effects'}
              onClick={() => setActiveTab('effects')}
              style={{
                ...glassmorphismStyles.tabButton,
                ...(activeTab === 'effects' ? glassmorphismStyles.tabButtonActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Effects
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'project'}
              onClick={() => setActiveTab('project')}
              style={{
                ...glassmorphismStyles.tabButton,
                ...(activeTab === 'project' ? glassmorphismStyles.tabButtonActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Project
            </button>
          </div>
        </div>

        <div className="panel-content" style={glassmorphismStyles.panelContent}>
          {activeTab === 'clip' && (
            <>
              <div className="clip-header" style={glassmorphismStyles.clipHeader}>
                <div className="clip-type-badge" style={{
                  ...glassmorphismStyles.clipTypeBadge,
                  background: selectedClip.color || theme.colors.accentCyan,
                }}>
                  {selectedClip.type?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="clip-info" style={glassmorphismStyles.clipInfo}>
                  <h3 style={glassmorphismStyles.clipName}>{selectedClip.name || 'Unnamed Clip'}</h3>
                  <span style={glassmorphismStyles.clipMeta}>
                    {selectedClip.duration ? `${selectedClip.duration.toFixed(2)}s` : ''}
                    {selectedClip.type && ` • ${selectedClip.type}`}
                    {selectedTrack && ` • Track: ${selectedTrack.name}`}
                  </span>
                </div>
              </div>
              {renderTransformSection()}
              {renderOpacitySection()}
              {renderSpeedSection()}
              {renderColorSection()}
              {selectedClip.type === 'audio' || selectedClip.type === 'video' ? renderAudioSection() : null}
              {renderEffectsSection()}
              {renderTextSection()}
            </>
          )}

          {activeTab === 'track' && selectedTrack && (
            <>
              <div className="clip-header" style={glassmorphismStyles.clipHeader}>
                <div className="clip-type-badge" style={{
                  ...glassmorphismStyles.clipTypeBadge,
                  background: selectedTrack.color || theme.colors.accentMint,
                }}>
                  {selectedTrack.label?.charAt(0) || 'T'}
                </div>
                <div className="clip-info" style={glassmorphismStyles.clipInfo}>
                  <h3 style={glassmorphismStyles.clipName}>{selectedTrack.name}</h3>
                  <span style={glassmorphismStyles.clipMeta}>
                    {selectedTrack.type} track • {tracks.indexOf(selectedTrack) + 1} of {tracks.length}
                  </span>
                </div>
              </div>
              <section className="property-section" style={glassmorphismStyles.propertySection}>
                <div className="property-grid" style={glassmorphismStyles.propertyGrid}>
                  <div className="property-row" style={glassmorphismStyles.propertyRow}>
                    <label style={glassmorphismStyles.propertyLabel}>Track Name</label>
                    <input
                      type="text"
                      value={selectedTrack.name}
                      onChange={(e) => onTrackUpdate(selectedTrack.id, { name: e.target.value })}
                      style={glassmorphismStyles.textInput}
                    />
                  </div>
                  <div className="property-row" style={glassmorphismStyles.propertyRow}>
                    <label style={glassmorphismStyles.propertyLabel}>Type</label>
                    <select
                      value={selectedTrack.type}
                      onChange={(e) => onTrackUpdate(selectedTrack.id, { type: e.target.value })}
                      style={glassmorphismStyles.selectInput}
                    >
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="text">Text</option>
                      <option value="effect">Effect</option>
                    </select>
                  </div>
                  <div className="property-row" style={glassmorphismStyles.propertyRow}>
                    <label style={glassmorphismStyles.propertyLabel}>Color</label>
                    <div className="color-picker-group" style={glassmorphismStyles.colorPickerGroup}>
                      <input
                        type="color"
                        value={selectedTrack.color || theme.colors.accentCyan}
                        onChange={(e) => onTrackUpdate(selectedTrack.id, { color: e.target.value })}
                        style={glassmorphismStyles.colorInput}
                      />
                    </div>
                  </div>
                  <div className="property-row" style={glassmorphismStyles.propertyRow}>
                    <label style={glassmorphismStyles.propertyLabel}>Volume</label>
                    <div className="property-input-group" style={glassmorphismStyles.propertyInputGroup}>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="1"
                        value={selectedTrack.volume || 100}
                        onChange={(e) => onTrackUpdate(selectedTrack.id, { volume: parseInt(e.target.value) })}
                        style={glassmorphismStyles.propertySlider}
                      />
                      <span style={glassmorphismStyles.propertyUnit}>{selectedTrack.volume || 100}%</span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'effects' && (
            <div className="effects-panel" style={glassmorphismStyles.effectsPanel}>
              <div className="effects-header" style={glassmorphismStyles.effectsHeader}>
                <h3 style={glassmorphismStyles.effectsTitle}>Available Effects</h3>
                <input
                  type="search"
                  placeholder="Search effects..."
                  style={glassmorphismStyles.effectsSearch}
                />
              </div>
              <div className="effects-categories" style={glassmorphismStyles.effectsCategories}>
                {['Color', 'Blur', 'Distort', 'Stylize', 'Transition', 'Utility', 'Audio'].map(cat => (
                  <button
                    key={cat}
                    className="effect-category-btn"
                    style={glassmorphismStyles.effectCategoryBtn}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="effects-grid" style={glassmorphismStyles.effectsGrid}>
                {(availableEffects || [
                  { name: 'Color Grade', category: 'Color', description: 'Professional color grading' },
                  { name: 'Gaussian Blur', category: 'Blur', description: 'Smooth blur effect' },
                  { name: 'Motion Blur', category: 'Blur', description: 'Directional motion blur' },
                  { name: 'Glow', category: 'Stylize', description: 'Add glow to bright areas' },
                  { name: 'Vignette', category: 'Stylize', description: 'Darken edges' },
                  { name: 'Film Grain', category: 'Stylize', description: 'Add film texture' },
                  { name: 'Chromatic Aberration', category: 'Distort', description: 'RGB channel separation' },
                  { name: 'RGB Split', category: 'Distort', description: 'Channel offset effect' },
                  { name: 'LUT', category: 'Color', description: 'Apply lookup table' },
                  { name: 'Sharpen', category: 'Stylize', description: 'Enhance detail' },
                  { name: 'Noise', category: 'Stylize', description: 'Add digital noise' },
                  { name: 'Halftone', category: 'Stylize', description: 'Print halftone effect' },
                ]).map(effect => (
                  <button
                    key={effect.name}
                    className="effect-card"
                    style={glassmorphismStyles.effectCard}
                  >
                    <h4 style={glassmorphismStyles.effectCardName}>{effect.name}</h4>
                    <span className="effect-category-tag" style={glassmorphismStyles.effectCategoryTag}>
                      {effect.category}
                    </span>
                    <p style={glassmorphismStyles.effectCardDesc}>{effect.description}</p>
                    <span className="add-to-clip" style={glassmorphismStyles.addToClip}>Add to Clip</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'project' && renderProjectSettings()}
        </div>
      </div>
    );
  }
);

PropertiesPanel.displayName = 'PropertiesPanel';