'use client';

import { useState, useEffect } from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [waveIntensity, setWaveIntensity] = useState(0);

  const {
    isRecording,
    transcript,
    error,
    retryCount,
    isSupported,
    toggleRecording,
    clearError,
  } = useSpeechRecognition({
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxRetries: 3,
    onTranscriptChange: onTranscript,
  });

  // Simulate wave intensity animation
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setWaveIntensity(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWaveIntensity(0);
    }
  }, [isRecording]);

  const handleToggleRecording = () => {
    if (error) {
      clearError();
    }
    toggleRecording();
  };

  return (
    <div className="w-full relative group">
        <div className="flex flex-col items-center gap-6">
          {/* Error Display */}
          {error && (
            <div className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Recording Button with Wave Animation */}
          <div className="relative">
            {/* Animated Waves */}
            {isRecording && !error && (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping"
                    style={{
                      animationDuration: `${1 + i * 0.3}s`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </>
            )}

            {/* Main Mic Button */}
            <button
              onClick={handleToggleRecording}
              disabled={!isSupported}
              className={`relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
                !isSupported ? 'bg-gray-500/10 cursor-not-allowed' :
                error ? 'bg-red-500/10' : 'bg-foreground/5'
              }`}
            >
              <Mic size={54} className={error ? "text-red-400" : isSupported ? "text-white" : "text-gray-500"} />
            </button>
          </div>

          {/* Wave Visualization */}
          {isRecording && !error && (
            <div className="flex items-center justify-center gap-1 h-12">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-linear-to-t from-foreground/50 to-primary rounded-full transition-all duration-100"
                  style={{
                    height: `${Math.abs(Math.sin((waveIntensity + i * 10) * 0.1)) * 50 + 10}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Real-time Transcript Display */}
          {transcript && !error && (
            <div className="w-full mt-4 p-6 bg-white/5 rounded-xl border border-white/10">
              <p className="text-base text-neutral-200 leading-relaxed">"{transcript}"</p>
            </div>
          )}

          {/* Helper Text */}
          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                error ? 'bg-red-500' : 
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500/50'
              }`} />
              <span>
                {error ? 'Error' : isRecording ? 'Recording' : 'Ready'}
              </span>
            </div>
            {retryCount > 0 && (
              <span className="text-yellow-400">
                Retry {retryCount}/3
              </span>
            )}
          </div>
        </div>
    </div>
  );
}
