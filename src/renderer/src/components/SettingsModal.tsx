import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

type Mode = 'auto' | 'subscription' | 'apiKey'

const MODES: { value: Mode; label: string; help: string }[] = [
  {
    value: 'subscription',
    label: 'Claude subscription (OAuth)',
    help: 'Uses your Claude Pro/Max plan. Generate a token with `claude setup-token` in a terminal and paste it below. Billed against your subscription, not the API.'
  },
  {
    value: 'auto',
    label: 'Use existing Claude Code login',
    help: 'No token needed here — if you are already logged into Claude Code on this machine (`claude`), the app reuses that subscription login automatically.'
  },
  {
    value: 'apiKey',
    label: 'Anthropic API key',
    help: 'Pay-per-use API key (sk-ant-…). A fallback for when your subscription is out of quota.'
  }
]

export default function SettingsModal({ onClose }: Props): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('subscription')
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [logFile, setLogFile] = useState('')

  useEffect(() => {
    window.api.getAuthStatus().then((s) => {
      setMode(s.mode as Mode)
      setHasToken(s.hasToken)
    })
    window.api.getModel().then(setModel)
    window.api.getLogPath().then(setLogFile)
  }, [])

  const save = async (): Promise<void> => {
    // Keep an existing stored token if the field is left blank (it's never read back).
    const status = await window.api.setAuth({ mode, token })
    await window.api.setModel(model)
    setHasToken(status.hasToken)
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const active = MODES.find((m) => m.value === mode)!
  const needsToken = mode !== 'auto'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>AI settings</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-section-label">How the AI authenticates</p>
          {MODES.map((m) => (
            <label key={m.value} className={`auth-option ${mode === m.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="authmode"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span className="auth-option-body">
                <span className="auth-option-label">{m.label}</span>
                <span className="auth-option-help">{m.help}</span>
              </span>
            </label>
          ))}

          {needsToken && (
            <div className="auth-token">
              <input
                type="password"
                placeholder={
                  hasToken
                    ? '•••••••• (a token is saved — type to replace)'
                    : mode === 'subscription'
                      ? 'Paste your OAuth token (sk-ant-oat…)'
                      : 'Paste your API key (sk-ant-api…)'
                }
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}

          <p className="auth-note">{active.help}</p>
          <p className="auth-note dim">
            Note: subscription login is for your own individual use. Each person using this app
            should sign in with their own Claude subscription or API key.
          </p>

          <p className="modal-section-label" style={{ marginTop: 18 }}>
            Model
          </p>
          <select className="model-select" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Default (your plan&apos;s default)</option>
            <option value="opus">Opus — most capable</option>
            <option value="sonnet">Sonnet — balanced</option>
            <option value="haiku">Haiku — fastest / cheapest</option>
          </select>
          <p className="auth-note dim">
            Which model the AI uses. &quot;Default&quot; follows your Claude plan. If a choice
            isn&apos;t included in your subscription you&apos;ll get an error — switch back to
            Default. The model that actually answered is shown under each reply.
          </p>

          <p className="modal-section-label" style={{ marginTop: 18 }}>
            Diagnostics
          </p>
          <p className="auth-note">
            Every AI call — auth, SDK messages, tool use, errors — is logged here. Tail it to
            watch what happens:
          </p>
          <div className="log-path-row">
            <code className="log-path">{logFile || '…'}</code>
            <button className="modal-btn" onClick={() => window.api.revealLog()}>
              Reveal
            </button>
          </div>
        </div>

        <div className="modal-footer">
          {saved && <span className="modal-saved">Saved</span>}
          <button className="modal-btn" onClick={onClose}>
            Close
          </button>
          <button className="modal-btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
