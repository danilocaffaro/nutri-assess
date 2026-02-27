import React, { useState, useEffect } from 'react';
import LZString from 'lz-string';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, X, Share2, MessageCircle, Link } from 'lucide-react';

export function generateShareLink(assessment) {
  try {
    const json = JSON.stringify(assessment);
    const compressed = LZString.compressToEncodedURIComponent(json);
    const base = window.location.origin;
    return `${base}/r/${compressed}`;
  } catch {
    return null;
  }
}

export default function ShareModal({ assessment, onClose }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    const url = generateShareLink(assessment);
    setLink(url || '');
  }, [assessment]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsApp = () => {
    const name = assessment?.patient?.name || 'Paciente';
    const msg = encodeURIComponent(
      `Olá ${name}! 👋\n\nSua avaliação física está pronta. Acesse pelo link abaixo:\n\n${link}\n\n_Powered by NutriAssess — CaffaroAI_`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (!link) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-white" />
            <h3 className="font-bold text-white">Compartilhar com Paciente</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient name */}
          <div className="text-center">
            <p className="text-sm text-gray-500">Avaliação de</p>
            <p className="text-lg font-bold text-gray-800">{assessment?.patient?.name || '—'}</p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm inline-block">
              <QRCodeSVG
                value={link}
                size={160}
                level="M"
                fgColor="#134e4a"
                imageSettings={{
                  src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjIgMTJIMiIgc3Ryb2tlPSIjMTM0ZTRhIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
                  width: 24,
                  height: 24,
                  excavate: true,
                }}
              />
            </div>
          </div>
          <p className="text-center text-xs text-gray-400">Aponte a câmera do celular para o QR Code</p>

          {/* Link field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Link do Paciente</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 truncate font-mono">
                {link.length > 60 ? link.substring(0, 60) + '…' : link}
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20b558] text-white font-bold py-3 rounded-xl transition-colors"
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
            >
              <Link size={18} />
              {copied ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>

          {/* Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700">
              <strong>ℹ️ Como funciona:</strong> O link contém todos os dados da avaliação de forma segura. 
              O paciente abre o link e vê os resultados sem precisar de login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
