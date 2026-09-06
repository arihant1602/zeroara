import React from 'react';
import { StepNumber, PipelineState, NetworkListener } from '../hooks/usePipeline';
import { Check, Loader2, WifiOff, FileText, Scan, Flame, Key, Stamp } from 'lucide-react';

interface PipelineStepperProps {
  pipelineState: PipelineState;
  activeStep: StepNumber;
  completedSteps: number[];
  onSelectStep: (step: StepNumber) => void;
  networkActivity: NetworkListener;
  onLoadSample: () => void;
  onReset: () => void;
}

interface StepMeta {
  num: StepNumber;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  pipelineState,
  activeStep,
  completedSteps,
  onSelectStep,
  networkActivity,
  onLoadSample,
  onReset,
}) => {
  const steps: StepMeta[] = [
    { num: 1, label: '1. Ingest', sublabel: 'SHA-256 Digest', icon: <FileText size={16} /> },
    { num: 2, label: '2. OCR Detect', sublabel: 'Coords Extraction', icon: <Scan size={16} /> },
    { num: 3, label: '3. Pixel Burn', sublabel: 'Canvas Rasterize', icon: <Flame size={16} /> },
    { num: 4, label: '4. ZK Prove', sublabel: 'Groth16 Wasm', icon: <Key size={16} /> },
    { num: 5, label: '5. Audit Seal', sublabel: 'Load-Bearing Seal', icon: <Stamp size={16} /> },
  ];

  const isRunning =
    pipelineState !== 'IDLE' && pipelineState !== 'SEALED';

  return (
    <div className="neu-card" style={{ padding: '18px 24px', gap: '16px', borderRadius: '24px' }}>
      {/* Top Header Bar with Brand, Actions, and Network Egress Monitor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/logo.png"
            alt="Zeroara Logo"
            style={{
              width: '34px',
              height: '34px',
              objectFit: 'contain',
              display: 'block',
              filter: 'drop-shadow(0 2px 4px rgba(234, 88, 12, 0.3))',
            }}
          />
          <div className="brand-title" style={{ fontSize: '1.22rem', letterSpacing: '-0.02em' }}>
            ZEROARA
          </div>
          <span className="brand-tag">PROVABLE REDACTION ENGINE</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-inset-sm)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.74rem',
              color: 'var(--accent-secondary)',
              fontWeight: 600,
            }}
          >
            <WifiOff size={13} />
            <span>EGRESS: {networkActivity.egressBytes} KB / {networkActivity.egressRequests} REQ</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {pipelineState === 'IDLE' ? (
            <button
              className="neu-btn-primary"
              onClick={onLoadSample}
              style={{ padding: '10px 22px', fontSize: '0.86rem' }}
            >
              Load Sample Document & Run Pipeline
            </button>
          ) : isRunning ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-btn)',
                boxShadow: 'var(--shadow-inset-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--accent)',
                fontWeight: 700,
              }}
            >
              <Loader2 size={16} className="spin" />
              <span>STAGE RUNNING: {pipelineState}...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="neu-btn-secondary"
                onClick={onReset}
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Reset Pipeline
              </button>
              <button
                className="neu-btn-primary"
                onClick={onLoadSample}
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                Rerun Pipeline
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5-Node Connected Pipeline Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {steps.map((step) => {
          const isComplete = completedSteps.includes(step.num);
          const isActive =
            (pipelineState === 'INGESTING' && step.num === 1) ||
            (pipelineState === 'OCR_DETECTING' && step.num === 2) ||
            (pipelineState === 'BURNING_PIXELS' && step.num === 3) ||
            (pipelineState === 'PROVING_ZK' && step.num === 4) ||
            (pipelineState === 'SEALED' && step.num === 5 && activeStep === 5);

          const isSelected = activeStep === step.num;
          const isClickable = isComplete || isSelected;

          return (
            <div
              key={step.num}
              onClick={() => isClickable && onSelectStep(step.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '18px',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: isSelected
                  ? 'var(--shadow-inset), 0 0 0 2px var(--accent)'
                  : isComplete
                  ? 'var(--shadow-extruded-sm)'
                  : 'var(--shadow-inset-sm)',
                cursor: isClickable ? 'pointer' : 'not-allowed',
                opacity: isComplete || isActive ? 1 : 0.55,
                transition: 'all 250ms ease-out',
                position: 'relative',
              }}
            >
              {/* Status Circle Node */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: 'var(--bg-surface)',
                  boxShadow: isSelected
                    ? 'var(--shadow-accent-inset)'
                    : isComplete
                    ? 'var(--shadow-extruded-sm)'
                    : 'var(--shadow-inset-sm)',
                  color: isSelected
                    ? 'var(--accent)'
                    : isComplete
                    ? 'var(--accent-secondary)'
                    : 'var(--fg-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {isActive && isRunning ? (
                  <Loader2 size={16} className="spin" style={{ color: 'var(--accent)' }} />
                ) : isComplete ? (
                  <Check size={16} style={{ color: 'var(--accent-secondary)', strokeWidth: 3 }} />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step Labels */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: isSelected ? 'var(--accent)' : 'var(--fg-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    color: 'var(--fg-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {step.sublabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
