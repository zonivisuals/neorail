'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, AlertCircle } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const [waveIntensity, setWaveIntensity] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    // Check if browser supports Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsRecording(true);
        setError(null);
        setRetryCount(0);
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText + ' ';
          } else {
            interimTranscript += transcriptText;
          }
        }

        const fullTranscript = finalTranscript + interimTranscript;
        setTranscript(fullTranscript);
        onTranscript(fullTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle different error types
        if (event.error === 'network') {
          if (retryCount < maxRetries) {
            setError(`Network error. Retrying... (${retryCount + 1}/${maxRetries})`);
            setRetryCount(prev => prev + 1);
            
            // Retry after a short delay
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  console.error('Failed to restart:', e);
                }
              }
            }, 1000);
          } else {
            setError('Network error. Please check your internet connection and try again.');
            setIsRecording(false);
          }
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone permissions.');
          setIsRecording(false);
        } else if (event.error === 'no-speech') {
          // Restart automatically on no-speech
          if (isRecording) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('Failed to restart after no-speech:', e);
            }
          }
        } else {
          setError(`Error: ${event.error}. Please try again.`);
          setIsRecording(false);
        }
      };

      recognitionRef.current.onend = () => {
        // Auto-restart if still supposed to be recording
        if (isRecording && retryCount < maxRetries) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to restart:', e);
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
    };
  }, [isRecording, retryCount]);

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

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (e) {
        console.error('Error stopping recording:', e);
      }
    } else {
      setTranscript('');
      onTranscript('');
      setError(null);
      setRetryCount(0);
      
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Error starting recording:', e);
        setError('Failed to start recording. Please try again.');
      }
    }
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
              onClick={toggleRecording}
              className={`relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
                error ? 'bg-red-500/10' : 'bg-foreground/5'
              }`}
            >
              <Mic size={54} className={error ? "text-red-400" : "text-white"} />
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
                Retry {retryCount}/{maxRetries}
              </span>
            )}
          </div>
        </div>
    </div>
  );
}
