import './creator-store.css';

export function CreatorStorePage() {
  return (
    <div className="cs-workspace">
      <div className="cs-glow cs-glow--a" aria-hidden="true" />
      <div className="cs-glow cs-glow--b" aria-hidden="true" />
      <div className="cs-glow cs-glow--c" aria-hidden="true" />
      <div className="cs-panel" role="region" aria-label="Creator Store">
        <div className="cs-topbar" />
        <div className="cs-canvas" />
      </div>
    </div>
  );
}
