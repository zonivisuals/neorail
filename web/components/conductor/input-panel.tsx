'use client'

import { useState, useRef, useEffect, useTransition } from 'react';
import { Mic, Image as ImageIcon, Cpu, Send, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { VoiceInput } from './voice-input';
import { createReport } from '@/app/actions/createReport';

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
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [isPending, startTransition] = useTransition();
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

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

  const handleSubmit = async () => {
    // Validation
    if (!message.trim()) {
      setSubmitStatus({
        type: 'error',
        message: 'Please enter a report description',
      });
      return;
    }

    if (!location.trim()) {
      setSubmitStatus({
        type: 'error',
        message: 'Please enter a location',
      });
      return;
    }

    // Clear previous status
    setSubmitStatus({ type: null, message: '' });

    startTransition(async () => {
      try {
        // Convert images to base64 URLs (already done by FileReader)
        const imageUrls = uploadedImages.map(img => img.url);

        // Create FormData
        const formData = new FormData();
        formData.append('content', message.trim());
        formData.append('location', location.trim());
        formData.append('urgency', urgency);

        // Call server action
        const result = await createReport(formData, imageUrls);

        if (result.success) {
          setSubmitStatus({
            type: 'success',
            message: `Report created successfully! ID: ${result.reportId}`,
          });

          // Clear form
          onMessageChange('');
          setLocation('');
          setUrgency('MEDIUM');
          setUploadedImages([]);

          // Clear success message after 3 seconds
          setTimeout(() => {
            setSubmitStatus({ type: null, message: '' });
          }, 3000);
        } else {
          setSubmitStatus({
            type: 'error',
            message: result.error,
          });
        }
      } catch (error) {
        console.error('Submit error:', error);
        setSubmitStatus({
          type: 'error',
          message: 'Failed to submit report. Please try again.',
        });
      }
    });
  };

  return (
    <>
      
      <div className="w-full relative group">
      {/* Status Messages */}
      {submitStatus.type && (
        <div
          className={`mb-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
            submitStatus.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {submitStatus.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{submitStatus.message}</span>
        </div>
      )}

      <div className="relative bg-background/50 border-2 rounded-2xl p-2 transition-all duration-300">
        {/* Location & Urgency Fields */}
        <div className="px-4 pt-4 pb-2 space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Location (e.g., Platform 5, Track 2)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isPending}
              className="flex-1 bg-white/5 text-sm text-white placeholder-neutral-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            />
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              disabled={isPending}
              className="bg-white/5 text-sm text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            >
              <option value="LOW" className="bg-neutral-900">Low</option>
              <option value="MEDIUM" className="bg-neutral-900">Medium</option>
              <option value="HIGH" className="bg-neutral-900">High</option>
              <option value="CRITICAL" className="bg-neutral-900">Critical</option>
            </select>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="p-4 pb-2">
          <textarea
            ref={textareaRef}
            placeholder="Describe the incident in detail..."
            value={message}
            onChange={handleInputChange}
            disabled={isPending}
            rows={1}
            className="w-full bg-transparent text-md text-white placeholder-neutral-600 focus:outline-none resize-none leading-relaxed font-light scrollbar-none disabled:opacity-50"
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
          <button
            onClick={handleSubmit}
            disabled={isPending || !message.trim() || !location.trim()}
            className="ml-auto bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-[0_0_10px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>Send Report</span>
                <Send size={16} />
              </>
            )}
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