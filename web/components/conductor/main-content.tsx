'use client'

import { useState, useRef } from 'react';
import { InputPanel } from './input-panel';
import { VoiceInput } from './voice-input';

export function MainContent() {
  const [inputMessage, setInputMessage] = useState('');
  const baseMessageRef = useRef(''); // The text before starting voice input

  const handleVoiceTranscript = (text: string) => {
    // When voice input starts, capture the existing message as the base
    // Then always append the current transcript to that base
    setInputMessage(prevMessage => {
      // If baseMessageRef is empty, this is the first transcript - store the base
      if (!baseMessageRef.current) {
        baseMessageRef.current = prevMessage;
      }
      
      // Always combine base message with current transcript
      const newMessage = baseMessageRef.current 
        ? `${baseMessageRef.current} ${text}`.trim()
        : text;
      
      return newMessage;
    });
  };

  const handleVoiceStop = () => {
    // Reset the base when voice recording stops
    baseMessageRef.current = '';
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center p-6 relative z-0 min-h-0">
      <div className="w-full max-w-3xl flex flex-col gap-8 animate-[fadeIn_0.5s_ease-out] py-8">
        {/* Title & Subheader */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Report Operational Incident
          </h1>
        </div>

        {/* Voice Input Component */}
        <VoiceInput onTranscript={handleVoiceTranscript} onStop={handleVoiceStop} />

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
