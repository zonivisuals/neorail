"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { 
  Image as ImageIcon, 
  Send, 
  X, 
  Loader2, 
  AlertCircle,
  Mic
} from "lucide-react";
import { createReport } from "@/app/actions/createReport";
import { useConductorDashboard } from "@/lib/stores/conductorDashboardStore";
import { VoiceInput } from "../voice-input";

interface UploadedImage {
  id: string;
  url: string;
  file: File;
}

/**
 * New Report View - Form for creating a new incident report
 */
export function NewReportView() {
  const { submitReport } = useConductorDashboard();
  
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseMessageRef = useRef("");

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 160;
      
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = "auto";
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        textareaRef.current.style.overflowY = "hidden";
      }
    }
  }, [message]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
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
    e.target.value = "";
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleVoiceTranscript = (text: string) => {
    setMessage((prevMessage) => {
      if (!baseMessageRef.current) {
        baseMessageRef.current = prevMessage;
      }
      return baseMessageRef.current 
        ? `${baseMessageRef.current} ${text}`.trim()
        : text;
    });
  };

  const handleVoiceStop = () => {
    baseMessageRef.current = "";
  };

  const handleSubmit = async () => {
    // Validation
    if (!message.trim()) {
      setError("Please enter a report description");
      return;
    }

    if (!location.trim()) {
      setError("Please enter a location");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const imageUrls = uploadedImages.map((img) => img.url);
        const formData = new FormData();
        formData.append("content", message.trim());
        formData.append("location", location.trim());
        formData.append("urgency", urgency);

        const result = await createReport(formData, imageUrls);

        if (result.success) {
          // Create report object for store
          const newReport = {
            id: result.reportId,
            createdAt: new Date().toISOString(),
            content: message.trim(),
            location: location.trim(),
            urgency,
            status: "OPEN" as const,
            trainId: null, // Will be populated by server
            imageUrl: imageUrls,
            solution: null,
          };

          // Switch to waiting view
          submitReport(newReport);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error("Submit error:", err);
        setError("Failed to submit report. Please try again.");
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center p-6 relative z-0 min-h-0">
      <div className="w-full max-w-3xl flex flex-col gap-8 animate-[fadeIn_0.5s_ease-out] py-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Report Operational Incident
          </h1>
          <p className="text-neutral-500 text-sm">
            Describe the issue in detail. Our AI will analyze and provide a solution.
          </p>
        </div>

        {/* Voice Input Component */}
        <VoiceInput onTranscript={handleVoiceTranscript} onStop={handleVoiceStop} />

        {/* Separator */}
        <div className="flex items-center w-full">
          <div className="flex-1 h-px bg-linear-to-r from-white/50 to-transparent" />
          <span className="mx-4 text-lg text-neutral-500 uppercase">or</span>
          <div className="flex-1 h-px bg-linear-to-l from-white/50 to-transparent" />
        </div>

        {/* Form */}
        <div className="w-full relative group">
          {/* Error Message */}
          {error && (
            <div className="mb-3 p-3 rounded-lg flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={16} />
              <span>{error}</span>
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
                  onChange={(e) => setUrgency(e.target.value as typeof urgency)}
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
                onChange={(e) => setMessage(e.target.value)}
                disabled={isPending}
                rows={1}
                className="w-full bg-transparent text-md text-white placeholder-neutral-600 focus:outline-none resize-none leading-relaxed font-light scrollbar-none disabled:opacity-50"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              />
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-linear-to-r from-transparent via-white/5 to-transparent" />

            {/* Action Toolbar */}
            <div className="px-3 py-2 flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
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
                  disabled={isPending}
                  className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all disabled:opacity-50"
                  title="Upload image"
                >
                  <ImageIcon size={18} />
                </button>
              </div>

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
      </div>
    </div>
  );
}
