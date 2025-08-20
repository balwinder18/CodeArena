'use client';
import { useState } from 'react';
import { Copy } from 'lucide-react';

export default function CopyButton({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center px-3 text-sm font-medium text-white rounded hover:bg-gray-600 transition"
    >
      <Copy className="w-4 h-4 mr-1" />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
