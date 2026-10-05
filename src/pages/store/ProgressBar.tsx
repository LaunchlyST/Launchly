import { Check } from 'lucide-react';
import { STEP_LABELS } from './store';

export function ProgressBar({ step }: { step: number }) {
  // step is 1-based; fill fraction across the 6 nodes
  const fill = ((step - 1) / (STEP_LABELS.length - 1)) * 100;
  return (
    <div className="cs-progress" role="navigation" aria-label="Creator Store setup progress">
      <div className="cs-progress__track" aria-hidden="true">
        <div className="cs-progress__fill" style={{ width: `${fill}%` }} />
      </div>
      <ol className="cs-progress__steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : 'todo';
          return (
            <li key={label} className={`cs-progress__node cs-progress__node--${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="cs-progress__dot" aria-hidden="true">
                {state === 'done' ? <Check size={12} strokeWidth={3} /> : <i>{n}</i>}
              </span>
              <span className="cs-progress__label">
                {label}
                {n === 5 && state === 'done' ? ' ✓' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
