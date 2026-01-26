'use client'

import { useState, useRef, useEffect } from 'react';
import { Mic, Image as ImageIcon, Cpu, Send, X } from 'lucide-react';
import { VoiceInput } from './voice-input';

interface UploadedImage {
  id: string;
  url: string;
  file: File;
}

interface InputPanelProps {
  message: string;
  onMessageChange: (message: string) => void;
}

export function InputPanel({ message, onMessageChange }: InputPanelProps) {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const removeImage = (id: string) => {
    setUploadedImages(uploadedImages.filter((img) => img.id !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newImage: UploadedImage = {
            id: `${Date.now()}-${Math.random()}`,
            url: event.target?.result as string,
            file: file,
          };
          setUploadedImages((prev) => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    e.target.value = '';
  };

  const handleVoiceTranscript = (text: string) => {
    onMessageChange(text);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 160; // Max height in pixels (about 8 lines)
      
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onMessageChange(e.target.value);
  };

  return (
    <>
      
      <div className="w-full relative group">
      <div className="relative bg-background/50 border-2 rounded-2xl p-2 transition-all duration-300">
        {/* Text Input Area */}
        <div className="p-4 pb-2">
          <textarea
            ref={textareaRef}
            placeholder="Type your message here..."
            value={message}
            onChange={handleInputChange}
            rows={1}
            className="w-full bg-transparent text-md text-white placeholder-neutral-600 focus:outline-none resize-none leading-relaxed font-light scrollbar-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          />
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-linear-to-r from-transparent via-white/5 to-transparent" />

        {/* Action Toolbar */}
        <div className="px-3 py-2 flex items-center justify-between mt-1">
          {/* Left Actions */}
          <div className="flex items-center gap-2">
            {/* Image Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all"
              title="Upload image"
            >
              <ImageIcon size={18} />
            </button>
          </div>

          {/* Send Button */}
          <button className="ml-auto bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            <span>Send</span>
            <Send size={16} />
          </button>
        </div>

        {/* Uploaded Images Preview */}
        {uploadedImages.length > 0 && (
          <div className="px-3 pb-3 flex flex-wrap gap-3">
            {uploadedImages.map((image) => (
              <div
                key={image.id}
                className="relative group/img w-16 h-16 rounded-lg overflow-hidden border border-white/10"
              >
                <img
                  src={image.url}
                  className="w-full h-full object-cover opacity-80 group-hover/img:opacity-100 transition-opacity"
                  alt="Upload preview"
                />
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-500/80 backdrop-blur rounded flex items-center justify-center text-white transition-colors opacity-0 group-hover/img:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Input Component */}
      {isVoiceActive && (
        <div className="absolute bottom-full left-0 right-0 mb-2">
          <VoiceInput onTranscript={handleVoiceTranscript} />
        </div>
      )}

      {/* Helper Text */}
      <div className="flex justify-between items-center px-2 mt-3 text-[10px] text-neutral-600">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">⌘ + Enter to send</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          <span>System Online</span>
        </div>
      </div>

      </div>
    </>
  );
}