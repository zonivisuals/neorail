'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Wifi, Globe, Lock } from 'lucide-react';

export function SpeechDiagnostics() {
  const [diagnostics, setDiagnostics] = useState({
    browserSupported: false,
    isSecure: false,
    isOnline: false,
    protocol: '',
    hostname: '',
    userAgent: '',
  });

  useEffect(() => {
    const checkDiagnostics = async () => {
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      // Test online connectivity
      let isOnline = navigator.onLine;
      try {
        // Try to fetch a small resource to confirm internet
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        isOnline = true;
      } catch (e) {
        console.warn('[SpeechDiagnostics] Internet connectivity test failed:', e);
        isOnline = false;
      }

      setDiagnostics({
        browserSupported: !!SpeechRecognitionAPI,
        isSecure: window.location.protocol === 'https:',
        isOnline,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        userAgent: navigator.userAgent,
      });
    };

    checkDiagnostics();

    // Listen for online/offline events
    const handleOnline = () => setDiagnostics(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setDiagnostics(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const DiagnosticItem = ({
    icon: Icon,
    label,
    status,
    message,
  }: {
    icon: any;
    label: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }) => {
    const colors = {
      success: 'text-green-400',
      warning: 'text-yellow-400',
      error: 'text-red-400',
    };

    const StatusIcon = status === 'success' ? CheckCircle2 : status === 'warning' ? AlertCircle : XCircle;

    return (
      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
        <Icon size={20} className={colors[status]} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{label}</span>
            <StatusIcon size={16} className={colors[status]} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{message}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6 bg-black/20 rounded-xl border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <AlertCircle size={20} />
        Speech Recognition Diagnostics
      </h3>

      <div className="space-y-3">
        <DiagnosticItem
          icon={Globe}
          label="Browser Support"
          status={diagnostics.browserSupported ? 'success' : 'error'}
          message={
            diagnostics.browserSupported
              ? 'Web Speech API is supported'
              : 'Web Speech API not supported. Please use Chrome or Edge.'
          }
        />

        <DiagnosticItem
          icon={Lock}
          label="Secure Connection"
          status={diagnostics.isSecure ? 'success' : 'warning'}
          message={
            diagnostics.isSecure
              ? `HTTPS (${diagnostics.protocol})`
              : `${diagnostics.protocol} - Localhost development mode. Network errors are common.`
          }
        />

        <DiagnosticItem
          icon={Wifi}
          label="Internet Connection"
          status={diagnostics.isOnline ? 'success' : 'error'}
          message={
            diagnostics.isOnline
              ? 'Connected to internet. Google Speech API should be reachable.'
              : 'No internet connection detected. Web Speech API requires internet access.'
          }
        />
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-200">
          <strong>Note:</strong> Web Speech API uses Google's servers for speech recognition. Network errors
          can occur due to:
        </p>
        <ul className="text-xs text-blue-200 mt-2 ml-4 space-y-1 list-disc">
          <li>Firewall or VPN blocking Google APIs</li>
          <li>Regional restrictions or network policies</li>
          <li>Temporary Google service issues</li>
          <li>Browser security restrictions</li>
        </ul>
      </div>

      <details className="mt-4">
        <summary className="text-xs text-neutral-400 cursor-pointer hover:text-neutral-300">
          Technical Details
        </summary>
        <div className="mt-2 p-3 bg-white/5 rounded text-xs font-mono text-neutral-300">
          <div>
            <strong>Hostname:</strong> {diagnostics.hostname}
          </div>
          <div className="mt-1">
            <strong>Protocol:</strong> {diagnostics.protocol}
          </div>
          <div className="mt-1 break-all">
            <strong>User Agent:</strong> {diagnostics.userAgent}
          </div>
        </div>
      </details>
    </div>
  );
}
