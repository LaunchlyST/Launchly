/**
 * The room: the editor's own chrome, sitting behind the glass.
 *
 * Structural only — panel geometry, no project data, no interactivity, nothing
 * fetched. The paywall blurs it to 24px; the unlock sequence re-uses the same
 * markup at full clarity for the arrival, so the user lands in the same room
 * they were looking at.
 */
export function EditorBackdrop({
  variant = 'plain',
}: {
  /** 'behind' is the copy that sits behind the glass: pushed a stop or two
      brighter so it survives a 24px blur and still reads as a room. */
  variant?: 'plain' | 'behind';
}) {
  return (
    <div className={`eb ${variant === 'behind' ? 'eb--behind' : ''}`} aria-hidden="true">
      <div className="eb__rail">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="eb__rail-dot" />
        ))}
      </div>

      <div className="eb__library" data-panel="library">
        <div className="eb__panel-head" />
        <div className="eb__thumbs">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="eb__thumb" />
          ))}
        </div>
      </div>

      <div className="eb__stage">
        <div className="eb__viewer" />
        <div className="eb__timeline" data-panel="timeline">
          <div className="eb__ruler" />
          {[0, 1, 2].map((track) => (
            <div key={track} className="eb__track">
              {[0, 1, 2, 3].map((clip) => (
                <div
                  key={clip}
                  className="eb__clip"
                  style={{ flexGrow: 1 + ((track + clip) % 3) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="eb__props" data-panel="props">
        <div className="eb__panel-head" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="eb__field">
            <span className="eb__field-label" />
            <span className="eb__field-value" />
          </div>
        ))}
      </div>
    </div>
  );
}
