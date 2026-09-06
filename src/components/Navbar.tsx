import { isTauriEnvironment } from '../services/tauriClient';

interface NavbarProps {
  activeTab: 'overview' | 'studio' | 'verifier' | 'spec';
  setActiveTab: (tab: 'overview' | 'studio' | 'verifier' | 'spec') => void;
  hasBurnedBundle: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasBurnedBundle,
}) => {
  const isTauri = isTauriEnvironment();

  return (
    <header className="neu-navbar">
      <div className="brand-section">
        <span className="brand-title">ZEROARA</span>
        <span className="brand-tag">PROVABLE REDACTION</span>
      </div>

      <nav className="neu-nav-track">
        <button
          className={`neu-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Protocol Overview
        </button>

        <button
          className={`neu-nav-btn ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
        >
          Redaction Studio
        </button>

        <button
          className={`neu-nav-btn ${activeTab === 'verifier' ? 'active' : ''}`}
          onClick={() => setActiveTab('verifier')}
        >
          Audit Verifier
          {hasBurnedBundle && (
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                marginLeft: '8px',
                verticalAlign: 'middle',
              }}
            />
          )}
        </button>

        <button
          className={`neu-nav-btn ${activeTab === 'spec' ? 'active' : ''}`}
          onClick={() => setActiveTab('spec')}
        >
          Cryptographic Spec
        </button>
      </nav>

      <div className="neu-status-pill">
        <div className="neu-indicator-dot" />
        <span className="mono">{isTauri ? 'ENCLAVE: NATIVE' : 'ENCLAVE: WEB-SIM'}</span>
      </div>
    </header>
  );
};
