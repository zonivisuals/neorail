'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Web Speech API TypeScript declarations
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxRetries?: number;
  onTranscriptChange?: (transcript: string) => void;
}

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  retryCount: number;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
  clearTranscript: () => void;
  clearError: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    maxRetries = 3,
    onTranscriptChange,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRecordingRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') {
      console.log('[useSpeechRecognition] SSR detected, skipping initialization');
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('[useSpeechRecognition] Speech Recognition API not supported');
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setIsSupported(false);
      return;
    }

    console.log('[useSpeechRecognition] Initializing Speech Recognition API');
    setIsSupported(true);

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[useSpeechRecognition] Recognition started');
      console.log('[useSpeechRecognition] Config:', {
        language: recognition.lang,
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
      });
      setIsRecording(true);
      setError(null);
      shouldRestartRef.current = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          console.log(
            `[useSpeechRecognition] Final result: "${transcriptText}" (confidence: ${(confidence * 100).toFixed(1)}%)`
          );
          finalTranscript += transcriptText + ' ';
        } else {
          interimTranscript += transcriptText;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      
      if (fullTranscript.trim()) {
        console.log(`[useSpeechRecognition] Transcript updated: "${fullTranscript.trim()}"`);
        setTranscript(fullTranscript);
        onTranscriptChange?.(fullTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error(`[useSpeechRecognition] Error: ${event.error}`, event);
      console.log('[useSpeechRecognition] Error details:', {
        error: event.error,
        message: event.message,
        timeStamp: event.timeStamp,
        currentURL: window.location.href,
        isSecure: window.location.protocol === 'https:',
        userAgent: navigator.userAgent,
      });

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      switch (event.error) {
        case 'network':
          // Check if we're on localhost without HTTPS
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('[useSpeechRecognition] Running on localhost - network errors are common');
            console.warn('[useSpeechRecognition] Web Speech API requires internet connection even on localhost');
            console.warn('[useSpeechRecognition] This is a known limitation of the Web Speech API');
          }

          // Stop auto-restart immediately
          shouldRestartRef.current = false;

          setRetryCount((prev) => {
            const newCount = prev + 1;
            if (newCount <= maxRetries) {
              console.log(`[useSpeechRecognition] Network error, retrying... (${newCount}/${maxRetries})`);
              setError(`Network error. Retrying... (${newCount}/${maxRetries})`);
              
              // Stop current recognition before retrying
              try {
                recognition.stop();
              } catch (e) {
                console.log('[useSpeechRecognition] Recognition already stopped');
              }

              // Retry after delay
              retryTimeoutRef.current = setTimeout(() => {
                console.log('[useSpeechRecognition] Attempting to restart after network error');
                if (isRecordingRef.current) {
                  shouldRestartRef.current = true;
                  try {
                    recognition.start();
                  } catch (e) {
                    console.error('[useSpeechRecognition] Failed to restart after network error:', e);
                    setError('Failed to restart. Please try again.');
                    setIsRecording(false);
                    shouldRestartRef.current = false;
                  }
                } else {
                  console.log('[useSpeechRecognition] Not restarting - user stopped recording');
                }
              }, 2000); // Increased delay to 2 seconds
            } else {
              console.error('[useSpeechRecognition] Max retries reached');
              console.error('[useSpeechRecognition] This usually means:');
              console.error('[useSpeechRecognition] 1. No internet connection');
              console.error('[useSpeechRecognition] 2. Firewall/VPN blocking Google Speech API');
              console.error('[useSpeechRecognition] 3. Regional restrictions');
              console.error('[useSpeechRecognition] 4. Google service temporarily unavailable');
              setError('Unable to connect to speech recognition service. This may be due to network restrictions, firewall settings, or internet connectivity issues.');
              setIsRecording(false);
            }
            return newCount;
          });
          break;

        case 'not-allowed':
          console.error('[useSpeechRecognition] Microphone permission denied');
          setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
          setIsRecording(false);
          shouldRestartRef.current = false;
          break;

        case 'no-speech':
          console.log('[useSpeechRecognition] No speech detected, continuing to listen...');
          // Don't set error, just restart if still recording
          if (isRecordingRef.current && shouldRestartRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Already started, ignore
            }
          }
          break;

        case 'aborted':
          console.log('[useSpeechRecognition] Recognition aborted');
          // User stopped, don't show error
          break;

        case 'audio-capture':
          console.error('[useSpeechRecognition] No microphone detected');
          setError('No microphone detected. Please connect a microphone and try again.');
          setIsRecording(false);
          shouldRestartRef.current = false;
          break;

        case 'service-not-allowed':
          console.error('[useSpeechRecognition] Service not allowed');
          setError('Speech recognition service is not allowed. Please check your browser settings.');
          setIsRecording(false);
          shouldRestartRef.current = false;
          break;

        default:
          console.error(`[useSpeechRecognition] Unknown error: ${event.error}`);
          setError(`Recognition error: ${event.error}. Please try again.`);
          setIsRecording(false);
          shouldRestartRef.current = false;
      }
    };

    recognition.onend = () => {
      console.log('[useSpeechRecognition] Recognition ended');
      console.log('[useSpeechRecognition] State check:', {
        isRecording: isRecordingRef.current,
        shouldRestart: shouldRestartRef.current,
        hasPendingRetry: !!retryTimeoutRef.current,
      });
      
      // Don't auto-restart if:
      // 1. User stopped recording (!isRecordingRef.current)
      // 2. We shouldn't restart (!shouldRestartRef.current)
      // 3. There's a pending retry timeout (retryTimeoutRef.current)
      if (isRecordingRef.current && shouldRestartRef.current && !retryTimeoutRef.current) {
        console.log('[useSpeechRecognition] Auto-restarting recognition...');
        try {
          recognition.start();
        } catch (e) {
          console.error('[useSpeechRecognition] Failed to auto-restart:', e);
          setIsRecording(false);
          setError('Recognition stopped unexpectedly. Please try again.');
        }
      } else {
        if (retryTimeoutRef.current) {
          console.log('[useSpeechRecognition] Not restarting - retry timeout is pending');
        } else if (!shouldRestartRef.current) {
          console.log('[useSpeechRecognition] Not restarting - shouldRestart is false');
        } else if (!isRecordingRef.current) {
          console.log('[useSpeechRecognition] Not restarting - user stopped recording');
        }
        
        // Only set isRecording to false if there's no pending retry
        if (!retryTimeoutRef.current) {
          setIsRecording(false);
        }
      }
    };

    recognition.onspeechstart = () => {
      console.log('[useSpeechRecognition] Speech detected');
    };

    recognition.onspeechend = () => {
      console.log('[useSpeechRecognition] Speech ended');
    };

    recognitionRef.current = recognition;

    return () => {
      console.log('[useSpeechRecognition] Cleaning up...');
      shouldRestartRef.current = false;
      
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [language, continuous, interimResults, maxRetries, onTranscriptChange]);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) {
      console.error('[useSpeechRecognition] Recognition not initialized');
      setError('Speech recognition is not available. Please use Chrome or Edge.');
      return;
    }

    console.log('[useSpeechRecognition] Starting recording...');
    
    // Clear any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setTranscript('');
    setError(null);
    setRetryCount(0);
    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
      console.log('[useSpeechRecognition] Start command sent successfully');
    } catch (e) {
      const error = e as Error;
      console.error('[useSpeechRecognition] Failed to start:', error);
      
      // If already started, stop and restart
      if (error.message?.includes('already started')) {
        console.log('[useSpeechRecognition] Already running, stopping first...');
        try {
          recognitionRef.current.stop();
          shouldRestartRef.current = false;
          
          setTimeout(() => {
            if (recognitionRef.current) {
              shouldRestartRef.current = true;
              recognitionRef.current.start();
              console.log('[useSpeechRecognition] Restarted successfully');
            }
          }, 100);
        } catch (stopError) {
          console.error('[useSpeechRecognition] Failed to restart:', stopError);
          setError('Failed to start recording. Please try again.');
          setIsRecording(false);
        }
      } else {
        setError('Failed to start recording. Please try again.');
        setIsRecording(false);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    console.log('[useSpeechRecognition] Stopping recording...');
    shouldRestartRef.current = false;
    setIsRecording(false);

    // Clear any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('[useSpeechRecognition] Error stopping:', e);
      }
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  const clearTranscript = useCallback(() => {
    console.log('[useSpeechRecognition] Clearing transcript');
    setTranscript('');
    onTranscriptChange?.('');
  }, [onTranscriptChange]);

  const clearError = useCallback(() => {
    console.log('[useSpeechRecognition] Clearing error');
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    isRecording,
    transcript,
    error,
    retryCount,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    clearTranscript,
    clearError,
  };
}
