import React, { useEffect, useState } from 'react';
import { Check, Copy, LoaderCircle } from 'lucide-react';
import { Modal, Unavailable } from './Modal';
import { monitorApi } from './monitorApi';
import { WORKER_URL } from '../../../lib/workerUrl';

interface Props {
  token: string | null;
  agentAvailable: boolean;
  online: boolean;
  deviceName: string | null;
  onClose: () => void;
  onPaired: () => void;
}

/**
 * Pairs the computer that will actually run coding tasks: generates a
 * one-time device token and shows the exact command to run the real local
 * agent (local-agent/agent.js) against it. Nothing here simulates a
 * connection — "Online" only ever reflects the agent's live WebSocket.
 */
export function DeviceConnectionModal({ token, agentAvailable, online, deviceName, onClose, onPaired }: Props) {
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ deviceToken: string; server: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setError('');
  }, []);

  async function pair() {
    setPairing(true);
    setError('');
    const r = await monitorApi.pairDevice(token, 'My computer');
    setPairing(false);
    if (!r.ok) {
      setError(r.reason === 'not_configured' ? 'The device relay isn’t set up on the server yet.' : r.message || 'Could not pair this computer.');
      return;
    }
    setIssued({ deviceToken: r.data.token, server: WORKER_URL.replace(/^http/, 'ws') });
    onPaired();
  }

  const command = issued ? `node agent.js --root "<your project folder>" --token ${issued.deviceToken} --server ${issued.server}` : '';

  return (
    <Modal title="Connect this computer" subtitle="Runs a small program on your computer so the AI can really read, edit and run your project." onClose={onClose} width={480}>
      {!agentAvailable && <Unavailable>The device relay isn’t set up on the server yet — coding tasks can’t reach a real computer.</Unavailable>}
      {agentAvailable && (
        <div className="mm-stack">
          <p className="mm-note">
            {online ? `Connected — ${deviceName ?? 'this computer'} is online and can run coding tasks.` : deviceName ? `${deviceName} is paired but not connected. Run the agent below to bring it online.` : 'No computer paired yet.'}
          </p>
          {!issued && (
            <button type="button" className="mm-btn mm-btn--primary mm-btn--block" onClick={pair} disabled={pairing}>
              {pairing ? <LoaderCircle size={14} className="spin" /> : null} {online ? 'Re-pair this computer' : 'Connect this computer'}
            </button>
          )}
          {error && <p className="mm-note mm-note--error">{error}</p>}
          {issued && (
            <div className="mm-stack">
              <p className="mm-note">
                Download <code>local-agent/</code> from the repository, run <code>npm install</code> once, then run this exact command on the computer with your
                project — it only ever touches the folder you point it at:
              </p>
              <div className="mm-code">
                <code>{command}</code>
                <button
                  type="button"
                  className="mv-tool"
                  aria-label="Copy command"
                  onClick={() => {
                    navigator.clipboard?.writeText(command).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="mm-note mm-note--muted">This token is shown once. If you lose it, connect again to issue a new one.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
