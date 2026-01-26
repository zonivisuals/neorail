'use client'

import { useState } from 'react';
import { InputPanel } from './input-panel';
import { VoiceInput } from './voice-input';
import { SpeechDiagnostics } from './speech-diagnostics';

export function MainContent() {
  const [inputMessage, setInputMessage] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleVoiceTranscript = (text: string) => {
    setInputMessage(text);
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center p-6 relative z-0 min-h-0">
      <div className="w-full max-w-3xl flex flex-col gap-8 animate-[fadeIn_0.5s_ease-out] py-8">
        {/* Title & Subheader */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Report Operational Anomaly
          </h1>
          <p className="text-neutral-500 text-sm max-w-md mx-auto">
            Detected a hazard? Submit multimodal evidence immediately to Central Command for AI analysis.
          </p>
        </div>

        {/* Diagnostics Toggle */}
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="text-xs text-neutral-400 hover:text-neutral-300 underline mx-auto"
        >
          {showDiagnostics ? 'Hide' : 'Show'} Speech Recognition Diagnostics
        </button>

        {/* Diagnostics Panel */}
        {showDiagnostics && <SpeechDiagnostics />}

        {/* Voice Input Component */}
        <VoiceInput onTranscript={handleVoiceTranscript} />

        {/* or seperator */}
        <div className="flex items-center w-full">
          <div className="flex-1 h-px bg-linear-to-r from-white/50 to-transparent" />
          <span className="mx-4 text-lg text-neutral-500 uppercase">or</span>
          <div className="flex-1 h-px bg-linear-to-l from-white/50 to-transparent" />
        </div>

        {/* text Input Component */}
        <InputPanel message={inputMessage} onMessageChange={setInputMessage} />
      </div>
    </div>
  );
}
