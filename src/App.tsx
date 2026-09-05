import { useState } from 'react';
import './App.css';
import { Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { StudioView } from './components/StudioView';
import { VerifierView } from './components/VerifierView';
import { ArchitectureView } from './components/ArchitectureView';
import { ProvableRedactionBundle } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'studio' | 'verifier' | 'spec'>('overview');
  const [activeBundle, setActiveBundle] = useState<ProvableRedactionBundle | null>(null);

  const handleBundleGenerated = (bundle: ProvableRedactionBundle) => {
    setActiveBundle(bundle);
  };

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasBurnedBundle={!!activeBundle}
      />

      <main className="main-viewport">
        {activeTab === 'overview' && (
          <OverviewView
            onBundleGenerated={handleBundleGenerated}
            onNavigateToStudio={() => setActiveTab('studio')}
            onNavigateToVerifier={() => setActiveTab('verifier')}
          />
        )}

        {activeTab === 'studio' && (
          <StudioView
            activeBundle={activeBundle}
            onBundleGenerated={handleBundleGenerated}
            onNavigateToVerifier={() => setActiveTab('verifier')}
          />
        )}

        {activeTab === 'verifier' && (
          <VerifierView initialBundle={activeBundle} />
        )}

        {activeTab === 'spec' && <ArchitectureView />}
      </main>
    </div>
  );
}

export default App;
