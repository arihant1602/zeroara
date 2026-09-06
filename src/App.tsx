import './App.css';
import { usePipeline } from './hooks/usePipeline';
import { PipelineStepper } from './components/PipelineStepper';
import { DocumentViewport } from './components/DocumentViewport';
import { TelemetryInspector } from './components/TelemetryInspector';
import { VerificationGate } from './components/VerificationGate';
import { EnterpriseSpecModal } from './components/EnterpriseSpecModal';

export function App() {
  const {
    pipelineState,
    activeStep,
    completedSteps,
    telemetry,
    networkActivity,
    enterprisePolicy,
    enterpriseModalOpen,
    verificationModalOpen,
    verificationResult,
    isVerifying,
    uploadDocument,
    loadSampleDocument,
    runPipelineFromIngest,
    updateEnterprisePolicy,
    selectStep,
    runEnterpriseVerification,
    downloadRedactedPdf,
    exportAuditReceipt,
    resetPipeline,
    setEnterpriseModalOpen,
    setVerificationModalOpen,
  } = usePipeline();

  const isSealed = pipelineState === 'SEALED';
  const hasDocument = !!telemetry.ingest;

  return (
    <div className="app-shell">
      {/* Scrollable Viewport Container */}
      <main className="main-viewport" style={{ padding: '20px 32px 40px 32px' }}>
        <div className="view-container" style={{ maxWidth: '1360px', gap: '20px' }}>
          {/* 1. Top Pipeline Stepper (Visual Map & State Machine Controller) */}
          <PipelineStepper
            pipelineState={pipelineState}
            activeStep={activeStep}
            completedSteps={completedSteps}
            onSelectStep={selectStep}
            networkActivity={networkActivity}
            onLoadSample={loadSampleDocument}
            onReset={resetPipeline}
            enterprisePolicy={enterprisePolicy}
            onOpenEnterpriseModal={() => setEnterpriseModalOpen(true)}
          />

          {/* 2. Split-Pane Workspace (Side-by-Side Left & Right Panels) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
              gap: '20px',
              alignItems: 'stretch',
            }}
          >
            {/* Left Panel: Document Viewport (PDF / Canvas / Dropzone) */}
            <DocumentViewport
              activeStep={activeStep}
              pipelineState={pipelineState}
              telemetry={telemetry}
              onUploadFile={uploadDocument}
              onLoadSample={loadSampleDocument}
            />

            {/* Right Panel: Cryptographic Telemetry Inspector */}
            <TelemetryInspector
              activeStep={activeStep}
              telemetry={telemetry}
              enterprisePolicy={enterprisePolicy}
              onOpenEnterpriseModal={() => setEnterpriseModalOpen(true)}
              onProceedToNextStep={() => runPipelineFromIngest()}
              onDownloadPdf={downloadRedactedPdf}
              onExportReceipt={exportAuditReceipt}
              onSelectStep={selectStep}
              hasDocument={hasDocument}
            />
          </div>

          {/* 3. One-Click Verification Gate (Bottom Action Strip & Modal) */}
          <VerificationGate
            isSealed={isSealed}
            isVerifying={isVerifying}
            onRunVerification={runEnterpriseVerification}
            verificationResult={verificationResult}
            isOpen={verificationModalOpen}
            onClose={() => setVerificationModalOpen(false)}
          />

          {/* 4. Enterprise Verification Simulator Modal */}
          <EnterpriseSpecModal
            isOpen={enterpriseModalOpen}
            onClose={() => setEnterpriseModalOpen(false)}
            policy={enterprisePolicy}
            onSavePolicy={updateEnterprisePolicy}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
