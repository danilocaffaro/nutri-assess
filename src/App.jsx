import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, User, Ruler, BarChart2, History, Printer, Save,
  ChevronDown, ChevronUp, Trash2, X, TrendingUp, TrendingDown,
  Share2, Camera, Zap, FlaskConical, BookOpen, UtensilsCrossed,
  ClipboardList, Upload, AlertCircle, CheckCircle2, Sparkles,
  Loader2, Info, Eye, Dumbbell, Plus
} from 'lucide-react';
import MealPlanModule from './MealPlanModule.jsx';

import {
  calcIMC, classifyIMC,
  calcRCQ, classifyRCQ,
  calcBodyFatJP3, calcBodyFatJP7, classifyBodyFat,
  calcBodyComposition,
  calcTMB, calcGET, ACTIVITY_FACTORS,
  calcPesoIdeal,
  fmt, colorClass, colorText, colorBg,
} from './utils/calculations';
import { loadHistory, saveAssessment, deleteAssessment, clearHistory, formatDate } from './utils/storage';
import ShareModal from './ShareModal.jsx';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const SECTIONS = [
  { id: 'preconsulta', label: 'Questionário Pré Consulta', icon: ClipboardList, color: 'emerald', soon: true },
  { id: 'anamnese', label: 'Anamnese', icon: User, color: 'purple' },
  { id: 'avaliacao360', label: 'Avaliação 360°', icon: Camera, color: 'blue', hero: true },
  { id: 'antropometrica', label: 'Avaliação Antropométrica', icon: Ruler, color: 'sky' },
  { id: 'energetico', label: 'Gastos Energéticos', icon: Zap, color: 'amber' },
  { id: 'laboratorial', label: 'Exames Laboratoriais', icon: FlaskConical, color: 'red', soon: true },
  { id: 'recordatorio', label: 'Recordatório Alimentar', icon: BookOpen, color: 'green', soon: true },
  { id: 'plano', label: 'Plano Alimentar', icon: UtensilsCrossed, color: 'violet' },
];

const SECTION_COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', active: 'bg-purple-600 text-white border-purple-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', active: 'bg-teal-600 text-white border-teal-600' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', active: 'bg-sky-600 text-white border-sky-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', active: 'bg-amber-500 text-white border-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', active: 'bg-red-600 text-white border-red-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', active: 'bg-green-600 text-white border-green-600' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', active: 'bg-violet-600 text-white border-violet-600' },
};

const DOENCAS_LIST = [
  'Diabetes tipo 1', 'Diabetes tipo 2', 'Hipertensão', 'Colesterol alto',
  'Hipotireoidismo', 'Hipertireoidismo', 'Anemia', 'Intolerância à lactose',
  'Doença celíaca', 'Gastrite/Refluxo', 'SOP', 'Depressão/Ansiedade',
];

// ─────────────────────────────────────────────────────────────────
// GEMINI VISION API
// ─────────────────────────────────────────────────────────────────
// Step 1: Validate photo quality before analysis
async function validatePhotoQuality(base64, label) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
  const prompt = `You are a photo quality validator for body composition analysis. Check if this ${label} photo is usable.

A GOOD photo must show: the person's body clearly visible, reasonable lighting, not too blurry, body not cropped out.
A BAD photo: too dark, too blurry, no person visible, face-only selfie, covered by clothes that hide body shape completely, screenshot of something else.

Return ONLY valid JSON: {"usable": true/false, "reason": "1 sentence in Portuguese explaining why"}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
    }),
  });
  if (!res.ok) return { usable: true, reason: 'Validação indisponível' }; // fallback: skip validation
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(clean); } catch { return { usable: true, reason: '' }; }
}

// Step 2: Full body composition analysis
async function analyzePhotosWithGemini({ frontalBase64, lateralBase64, weight, height, sex, age }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  // Validate photos first
  const validationErrors = [];
  if (frontalBase64) {
    const v = await validatePhotoQuality(frontalBase64, 'frontal');
    if (!v.usable) validationErrors.push(`📷 Foto frontal: ${v.reason}`);
  }
  if (lateralBase64) {
    const v = await validatePhotoQuality(lateralBase64, 'lateral');
    if (!v.usable) validationErrors.push(`📷 Foto lateral: ${v.reason}`);
  }
  if (validationErrors.length > 0) {
    throw new Error(`Fotos inadequadas para análise:\n${validationErrors.join('\n')}\n\nPor favor, tire novas fotos seguindo as orientações.`);
  }

  const prompt = `You are an expert nutritionist and body composition analyst. Analyze these patient photos (frontal and/or lateral view).

Patient data: Weight=${weight}kg, Height=${height}cm, Sex=${sex === 'M' ? 'Male' : 'Female'}, Age=${age} years.

Based on visual assessment of body shape, fat distribution, muscle definition, and the provided biometric data, estimate body composition.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation. Format:
{
  "bodyFatPercent": <number 5-50>,
  "leanMassKg": <number>,
  "fatMassKg": <number>,
  "bodyWaterPercent": <number 45-70>,
  "bodyType": "<Ectomorfo|Mesomorfo|Endomorfo>",
  "muscleDistribution": "<Uniforme|Superior|Inferior|Central>",
  "fatDistribution": "<Android/Central|Ginecoide/Periférica|Mista>",
  "visceralFatLevel": <1-12>,
  "observations": "<2-3 sentences in Portuguese about body composition findings>",
  "recommendations": "<2-3 sentences in Portuguese with nutrition/exercise recommendations>"
}`;

  const parts = [{ text: prompt }];
  if (frontalBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: frontalBase64 } });
  }
  if (lateralBase64) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: lateralBase64 } });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // Strip markdown code fences if present
  const clean = text.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // strip data:image/jpeg;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────────────────────────
function GaugeBar({ value, min, max, color }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="mt-1.5">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-700 ${colorBg(color)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, classification, gauge, icon: Icon, note, highlight }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-100'} shadow-sm`}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          {Icon && <Icon size={12} />}{title}
        </div>
        {classification && <span className={colorClass(classification.color)}>{classification.label}</span>}
      </div>
      <div className={`text-2xl font-bold ${classification ? colorText(classification.color) : highlight ? 'text-teal-700' : 'text-gray-800'}`}>
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
      {gauge && <GaugeBar {...gauge} />}
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

function InputField({ label, id, type = 'number', value, onChange, placeholder, min, max, step, className = '', suffix }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} min={min} max={max} step={step || '0.1'}
          className={`input-field ${suffix ? 'pr-10' : ''}`} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, collapsible, open, onToggle, badge }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? onToggle : undefined}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
          <Icon size={16} className="text-teal-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            {badge && <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full font-bold">{badge}</span>}
          </div>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {collapsible && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
    </div>
  );
}

function DeltaBadge({ current, previous, unit = '', inverse = false, decimals = 1 }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return <span className="badge-gray">= {fmt(current, decimals)} {unit}</span>;
  const positive = delta > 0;
  const sign = positive ? '+' : '';
  return (
    <span className={positive !== inverse ? 'badge-red' : 'badge-green'}>
      {positive ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
      {sign}{fmt(delta, decimals)} {unit}
    </span>
  );
}

function MiniLineChart({ data, color = '#0D9488' }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.value).filter(v => v != null);
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 200, H = 50, pad = 4;
  const pts = data.filter(d => d.value != null).map((d, i, arr) => {
    const x = pad + (i / (arr.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.filter(d => d.value != null).map((d, i, arr) => {
        const x = pad + (i / (arr.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// PHOTO UPLOADER
// ─────────────────────────────────────────────────────────────────
function PhotoUploader({ label, icon, preview, onFile, accept = 'image/*' }) {
  const ref = useRef();
  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
        ${preview ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-teal-300 hover:bg-teal-50/30'}`}
      style={{ minHeight: 160 }}
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files[0]; if (f) onFile(f); }} />
      {preview ? (
        <>
          <img src={preview} alt={label} className="w-full h-full object-cover" style={{ minHeight: 160, maxHeight: 220 }} />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-sm font-medium">Trocar foto</span>
          </div>
          <div className="absolute top-2 right-2 bg-teal-500 text-white rounded-full p-1">
            <CheckCircle2 size={14} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center gap-2">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-1">
            {icon}
          </div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">Arraste ou clique para selecionar</p>
          <div className="flex items-center gap-1 mt-1">
            <Upload size={12} className="text-teal-500" />
            <span className="text-xs text-teal-600 font-medium">Selecionar foto</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AI RESULT CARD
// ─────────────────────────────────────────────────────────────────
function AIResultCard({ result, weight, height, sex, age }) {
  const imc = calcIMC(parseFloat(weight), parseFloat(height));
  const imcClass = classifyIMC(imc);
  const bfClass = result.bodyFatPercent ? classifyBodyFat(result.bodyFatPercent, sex) : null;

  const statItems = [
    { label: '% Gordura Corporal', value: fmt(result.bodyFatPercent, 1), unit: '%', color: bfClass?.color, badge: bfClass?.label, gauge: { value: result.bodyFatPercent, min: 5, max: 45, color: bfClass?.color } },
    { label: 'Massa Magra', value: fmt(result.leanMassKg, 1), unit: 'kg', color: 'green' },
    { label: 'Massa Gorda', value: fmt(result.fatMassKg, 1), unit: 'kg', color: bfClass?.color },
    { label: 'Água Corporal', value: fmt(result.bodyWaterPercent, 1), unit: '%', color: 'green' },
    { label: 'IMC', value: fmt(imc, 1), unit: 'kg/m²', color: imcClass?.color, badge: imcClass?.label, gauge: { value: imc, min: 15, max: 40, color: imcClass?.color } },
    { label: 'Gordura Visceral', value: result.visceralFatLevel, unit: 'nível', color: result.visceralFatLevel > 9 ? 'red' : result.visceralFatLevel > 5 ? 'yellow' : 'green' },
  ];

  const colorMap = { green: 'text-emerald-600', yellow: 'text-amber-500', red: 'text-red-500' };

  return (
    <div className="space-y-4">
      {/* Hero row */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
            <p className="text-xs text-gray-500 font-medium leading-tight mb-1">{s.label}</p>
            <p className={`text-xl font-black ${colorMap[s.color] || 'text-gray-800'}`}>
              {s.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{s.unit}</span>
            </p>
            {s.badge && <span className={colorClass(s.color)}>{s.badge}</span>}
            {s.gauge && <GaugeBar {...s.gauge} />}
          </div>
        ))}
      </div>

      {/* Body type + distribution */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tipo Corporal', value: result.bodyType, icon: <Dumbbell size={14} className="text-teal-600" /> },
          { label: 'Distribuição Muscular', value: result.muscleDistribution, icon: <Activity size={14} className="text-teal-600" /> },
          { label: 'Distribuição de Gordura', value: result.fatDistribution, icon: <Eye size={14} className="text-teal-600" /> },
        ].map((item, i) => (
          <div key={i} className="bg-teal-50 rounded-xl border border-teal-100 p-3">
            <div className="flex items-center gap-1 mb-1">{item.icon}<p className="text-xs text-teal-600 font-medium">{item.label}</p></div>
            <p className="text-sm font-bold text-teal-800">{item.value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Observations */}
      {result.observations && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Info size={14} className="text-blue-600" />
            <p className="text-sm font-semibold text-blue-700">Análise Visual</p>
            <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-bold ml-1">IA</span>
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">{result.observations}</p>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={14} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">Recomendações</p>
          </div>
          <p className="text-sm text-emerald-800 leading-relaxed">{result.recommendations}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
        <Sparkles size={10} /> Análise gerada por Inteligência Artificial — use como suporte clínico
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMING SOON CARD
// ─────────────────────────────────────────────────────────────────
function ComingSoon({ title, icon: Icon, description }) {
  return (
    <div className="card text-center py-12">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Icon size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-3">{description}</p>
      <span className="inline-block bg-gray-100 text-gray-500 text-xs font-bold px-4 py-1.5 rounded-full">Em breve</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DIETBOX-STYLE MENU (shown when no patient selected / landing)
// ─────────────────────────────────────────────────────────────────
function DietboxMenu({ onSelect }) {
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Avaliação</h2>
        <p className="text-sm text-gray-400">Selecione um módulo para iniciar a avaliação do paciente</p>
      </div>
      {SECTIONS.map(s => {
        const colors = SECTION_COLOR_MAP[s.color] || SECTION_COLOR_MAP.blue;
        return (
          <div
            key={s.id}
            onClick={() => !s.soon && onSelect(s.id)}
            className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
              s.soon
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                : s.hero
                  ? `${colors.bg} ${colors.border} border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] shadow-sm`
                  : `bg-white border-gray-200 cursor-pointer hover:${colors.bg} hover:${colors.border} hover:shadow-sm`
            }`}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.hero ? colors.bg : 'bg-gray-100'}`}>
              <s.icon size={22} className={s.hero ? colors.text : 'text-gray-500'} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold text-sm ${s.hero ? colors.text : s.soon ? 'text-gray-400' : 'text-gray-800'}`}>
                  {s.hero ? '⭐ ' : ''}{s.label}
                </span>
                {s.hero && (
                  <span className={`text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-bold flex items-center gap-1`}>
                    <Sparkles size={10} /> IA
                  </span>
                )}
                {s.soon && (
                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Em breve</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {s.soon ? 'Disponível em breve' : `Adicionar ${s.label}`}
              </p>
            </div>

            {/* Arrow */}
            {!s.soon && (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                <Plus size={16} className={colors.text} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ANAMNESE MODULE
// ─────────────────────────────────────────────────────────────────
const DEFAULT_ANAMNESE = {
  // Histórico de Saúde
  doencas: [],
  doencasOutros: '',
  medicamentos: '',
  cirurgias: '',
  historicoFamiliar: [],
  historicoFamiliarOutros: '',
  // Hábitos Alimentares
  refeicoesDia: '3',
  alergias: '',
  naoGosta: '',
  consumoAgua: '1-2L',
  consumoAlcool: 'Não',
  // Hábitos de Vida
  exercita: 'Não',
  exercicioQual: '',
  exercicioFrequencia: '',
  qualidadeSono: 'Boa',
  horasSono: '7-8h',
  nivelEstresse: 'Moderado',
  tabagismo: 'Não',
  // Objetivo
  objetivo: 'Melhora da saúde geral',
  expectativa: '',
  observacoes: '',
};

function AnamneseModule({ anamnese, onChange }) {
  const set = (k, v) => onChange({ ...anamnese, [k]: v });

  const toggleDoenca = (d) => {
    const list = anamnese.doencas.includes(d)
      ? anamnese.doencas.filter(x => x !== d)
      : [...anamnese.doencas, d];
    set('doencas', list);
  };

  const toggleFamiliar = (d) => {
    const list = anamnese.historicoFamiliar.includes(d)
      ? anamnese.historicoFamiliar.filter(x => x !== d)
      : [...anamnese.historicoFamiliar, d];
    set('historicoFamiliar', list);
  };

  const selectCls = 'input-field';
  const textareaCls = 'input-field min-h-[80px] resize-none';
  const labelCls = 'label';

  return (
    <div className="space-y-4">
      {/* ── Histórico de Saúde ── */}
      <div className="card">
        <SectionHeader icon={Activity} title="Histórico de Saúde" subtitle="Doenças, medicamentos e histórico familiar" />

        <div className="mb-4">
          <p className={labelCls}>Doenças diagnosticadas</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {DOENCAS_LIST.map(d => (
              <label key={d} className="flex items-center gap-2 text-sm cursor-pointer group">
                <input
                  type="checkbox"
                  checked={anamnese.doencas.includes(d)}
                  onChange={() => toggleDoenca(d)}
                  className="accent-purple-600 w-4 h-4 rounded"
                />
                <span className="text-gray-700 group-hover:text-gray-900">{d}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm cursor-pointer group col-span-2 sm:col-span-1">
              <input
                type="checkbox"
                checked={anamnese.doencas.includes('Outros')}
                onChange={() => toggleDoenca('Outros')}
                className="accent-purple-600 w-4 h-4 rounded"
              />
              <span className="text-gray-700 group-hover:text-gray-900">Outros</span>
            </label>
          </div>
          {anamnese.doencas.includes('Outros') && (
            <input
              type="text"
              value={anamnese.doencasOutros}
              onChange={e => set('doencasOutros', e.target.value)}
              placeholder="Especifique outras doenças..."
              className="input-field mt-2"
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Medicamentos em uso</label>
            <textarea
              value={anamnese.medicamentos}
              onChange={e => set('medicamentos', e.target.value)}
              placeholder="Liste os medicamentos em uso..."
              className={textareaCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cirurgias anteriores</label>
            <textarea
              value={anamnese.cirurgias}
              onChange={e => set('cirurgias', e.target.value)}
              placeholder="Liste cirurgias realizadas..."
              className={textareaCls}
            />
          </div>
        </div>

        <div>
          <p className={labelCls}>Histórico familiar (doenças na família)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {DOENCAS_LIST.map(d => (
              <label key={d} className="flex items-center gap-2 text-sm cursor-pointer group">
                <input
                  type="checkbox"
                  checked={anamnese.historicoFamiliar.includes(d)}
                  onChange={() => toggleFamiliar(d)}
                  className="accent-purple-600 w-4 h-4 rounded"
                />
                <span className="text-gray-700 group-hover:text-gray-900">{d}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm cursor-pointer group col-span-2 sm:col-span-1">
              <input
                type="checkbox"
                checked={anamnese.historicoFamiliar.includes('Outros')}
                onChange={() => toggleFamiliar('Outros')}
                className="accent-purple-600 w-4 h-4 rounded"
              />
              <span className="text-gray-700 group-hover:text-gray-900">Outros</span>
            </label>
          </div>
          {anamnese.historicoFamiliar.includes('Outros') && (
            <input
              type="text"
              value={anamnese.historicoFamiliarOutros}
              onChange={e => set('historicoFamiliarOutros', e.target.value)}
              placeholder="Especifique..."
              className="input-field mt-2"
            />
          )}
        </div>
      </div>

      {/* ── Hábitos Alimentares ── */}
      <div className="card">
        <SectionHeader icon={BookOpen} title="Hábitos Alimentares" subtitle="Padrão alimentar e ingestão hídrica" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Refeições por dia</label>
            <select className={selectCls} value={anamnese.refeicoesDia} onChange={e => set('refeicoesDia', e.target.value)}>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={String(n)}>{n} refeição{n > 1 ? 'ões' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Consumo de água</label>
            <select className={selectCls} value={anamnese.consumoAgua} onChange={e => set('consumoAgua', e.target.value)}>
              {['<1L', '1-2L', '2-3L', '>3L'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Consumo de álcool</label>
            <select className={selectCls} value={anamnese.consumoAlcool} onChange={e => set('consumoAlcool', e.target.value)}>
              {['Não', 'Raramente', 'Semanal', 'Diário'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3 grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Alergias alimentares</label>
              <input
                type="text"
                value={anamnese.alergias}
                onChange={e => set('alergias', e.target.value)}
                placeholder="Ex: amendoim, frutos do mar..."
                className="input-field"
              />
            </div>
            <div>
              <label className={labelCls}>Alimentos que não gosta</label>
              <input
                type="text"
                value={anamnese.naoGosta}
                onChange={e => set('naoGosta', e.target.value)}
                placeholder="Ex: fígado, brócolis..."
                className="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Hábitos de Vida ── */}
      <div className="card">
        <SectionHeader icon={Dumbbell} title="Hábitos de Vida" subtitle="Exercícios, sono e bem-estar" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Pratica exercícios?</label>
            <select className={selectCls} value={anamnese.exercita} onChange={e => set('exercita', e.target.value)}>
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>
          {anamnese.exercita === 'Sim' && (
            <>
              <div>
                <label className={labelCls}>Qual exercício?</label>
                <input
                  type="text"
                  value={anamnese.exercicioQual}
                  onChange={e => set('exercicioQual', e.target.value)}
                  placeholder="Ex: musculação, corrida..."
                  className="input-field"
                />
              </div>
              <div>
                <label className={labelCls}>Frequência semanal</label>
                <input
                  type="text"
                  value={anamnese.exercicioFrequencia}
                  onChange={e => set('exercicioFrequencia', e.target.value)}
                  placeholder="Ex: 3x por semana"
                  className="input-field"
                />
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Qualidade do sono</label>
            <select className={selectCls} value={anamnese.qualidadeSono} onChange={e => set('qualidadeSono', e.target.value)}>
              {['Boa', 'Regular', 'Ruim', 'Insônia'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Horas de sono</label>
            <select className={selectCls} value={anamnese.horasSono} onChange={e => set('horasSono', e.target.value)}>
              {['<5h', '5-6h', '6-7h', '7-8h', '>8h'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nível de estresse</label>
            <select className={selectCls} value={anamnese.nivelEstresse} onChange={e => set('nivelEstresse', e.target.value)}>
              {['Baixo', 'Moderado', 'Alto'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tabagismo</label>
            <select className={selectCls} value={anamnese.tabagismo} onChange={e => set('tabagismo', e.target.value)}>
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Objetivo ── */}
      <div className="card">
        <SectionHeader icon={Sparkles} title="Objetivo" subtitle="Metas e expectativas do paciente" />
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Objetivo principal</label>
            <select className={selectCls} value={anamnese.objetivo} onChange={e => set('objetivo', e.target.value)}>
              {[
                'Perda de peso',
                'Ganho de massa muscular',
                'Melhora da saúde geral',
                'Tratamento de doença',
                'Performance esportiva',
                'Reeducação alimentar',
                'Outro',
              ].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expectativa de resultado</label>
            <textarea
              value={anamnese.expectativa}
              onChange={e => set('expectativa', e.target.value)}
              placeholder="O que o paciente espera alcançar com o acompanhamento nutricional..."
              className={textareaCls}
            />
          </div>
          <div>
            <label className={labelCls}>Observações adicionais</label>
            <textarea
              value={anamnese.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              placeholder="Informações adicionais relevantes..."
              className={textareaCls}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [activeSection, setActiveSection] = useState(null); // null = show menu
  const [activeTab, setActiveTab] = useState('assessment'); // assessment | history
  const [history, setHistory] = useState([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [skinfoldOpen, setSkinfoldOpen] = useState(false);
  const [protocol, setProtocol] = useState('3');
  const [shareEntry, setShareEntry] = useState(null);

  // AI 360 state
  const [frontalFile, setFrontalFile] = useState(null);
  const [lateralFile, setLateralFile] = useState(null);
  const [frontalPreview, setFrontalPreview] = useState(null);
  const [lateralPreview, setLateralPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPhase, setAiPhase] = useState(''); // 'validating' | 'analyzing'
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Patient form
  const [patient, setPatient] = useState({
    name: '', age: '', sex: 'F', date: new Date().toISOString().split('T')[0],
    height: '', weight: '', activityFactor: '1.55',
  });
  const [circumferences, setCircumferences] = useState({
    waist: '', hip: '', neck: '', chest: '',
    armR: '', armL: '', thighR: '', thighL: '', calfR: '', calfL: '',
  });
  const [skinfolds, setSkinfolds] = useState({
    triceps: '', biceps: '', subscapular: '', suprailiac: '',
    abdominal: '', thigh: '', chest: '',
  });

  // Anamnese state
  const [anamnese, setAnamnese] = useState({ ...DEFAULT_ANAMNESE });

  useEffect(() => { setHistory(loadHistory()); }, []);

  // ── Calculations ──────────────────────────────────────────────
  const imc = calcIMC(parseFloat(patient.weight), parseFloat(patient.height));
  const imcClass = classifyIMC(imc);
  const rcq = calcRCQ(parseFloat(circumferences.waist), parseFloat(circumferences.hip));
  const rcqClass = classifyRCQ(rcq, patient.sex);
  const bf3 = calcBodyFatJP3(skinfolds, patient.sex, parseFloat(patient.age));
  const bf7 = calcBodyFatJP7(skinfolds, patient.sex, parseFloat(patient.age));
  const activeBF = protocol === '7' ? bf7 : bf3;
  const bfClass = activeBF ? classifyBodyFat(activeBF.pct, patient.sex) : null;
  const bodyComp = activeBF ? calcBodyComposition(parseFloat(patient.weight), activeBF.pct) : null;
  const tmb = calcTMB(parseFloat(patient.weight), parseFloat(patient.height), parseFloat(patient.age), patient.sex);
  const get_ = calcGET(tmb, parseFloat(patient.activityFactor));
  const pesoIdeal = calcPesoIdeal(parseFloat(patient.height));
  const hasManualResults = imc !== null || rcq !== null || activeBF !== null || tmb !== null;

  // ── Photo handlers ────────────────────────────────────────────
  const handleFrontalFile = async (file) => {
    setFrontalFile(file);
    const preview = await fileToDataURL(file);
    setFrontalPreview(preview);
    setAiResult(null); setAiError(null);
  };
  const handleLateralFile = async (file) => {
    setLateralFile(file);
    const preview = await fileToDataURL(file);
    setLateralPreview(preview);
    setAiResult(null); setAiError(null);
  };

  // ── AI Analysis ───────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!patient.weight || !patient.height) {
      setAiError('Preencha peso e altura antes de analisar.');
      return;
    }
    if (!frontalFile && !lateralFile) {
      setAiError('Adicione pelo menos uma foto para análise.');
      return;
    }

    setAiLoading(true);
    setAiPhase('validating');
    setAiError(null);
    setAiResult(null);

    try {
      const frontalB64 = frontalFile ? await fileToBase64(frontalFile) : null;
      const lateralB64 = lateralFile ? await fileToBase64(lateralFile) : null;
      setAiPhase('analyzing');
      const result = await analyzePhotosWithGemini({
        frontalBase64: frontalB64,
        lateralBase64: lateralB64,
        weight: patient.weight,
        height: patient.height,
        sex: patient.sex,
        age: patient.age || 30,
      });
      setAiResult(result);
    } catch (err) {
      console.error(err);
      if (err.message.includes('Fotos inadequadas')) {
        setAiError(err.message);
      } else {
        setAiError(`Erro na análise: ${err.message}. Verifique sua conexão ou use a avaliação manual.`);
      }
    } finally {
      setAiLoading(false);
      setAiPhase('');
    }
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = () => {
    if (!patient.name || !patient.weight || !patient.height) {
      alert('Preencha pelo menos: nome, peso e altura.');
      return;
    }
    const entry = saveAssessment({
      patient, circumferences, skinfolds,
      anamnese,
      results: {
        imc, rcq,
        bf: aiResult?.bodyFatPercent ?? activeBF?.pct,
        tmb, get: get_, protocol,
        ai: aiResult || null,
      },
    });
    setHistory(loadHistory());
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
    setShareEntry(entry);
  };

  const handleDelete = (id) => {
    if (confirm('Remover esta avaliação?')) setHistory(deleteAssessment(id));
  };

  const setPat = (k, v) => setPatient(p => ({ ...p, [k]: v }));
  const setCirc = (k, v) => setCircumferences(c => ({ ...c, [k]: v }));
  const setSkin = (k, v) => setSkinfolds(s => ({ ...s, [k]: v }));

  const loadFromHistory = (entry) => {
    setPatient(entry.patient);
    setCircumferences(entry.circumferences || {});
    setSkinfolds(entry.skinfolds || {});
    setAnamnese(entry.anamnese || { ...DEFAULT_ANAMNESE });
    setProtocol(entry.results?.protocol === '7 dobras (J&P)' ? '7' : '3');
    if (entry.results?.ai) setAiResult(entry.results.ai);
    setActiveTab('assessment');
    setActiveSection('avaliacao360');
    window.scrollTo(0, 0);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 no-print">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setActiveSection(null); setActiveTab('assessment'); }}>
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shadow-sm">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">NutriAssess</span>
              <span className="text-xs text-gray-400 block leading-none">Avaliação Física Profissional</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { id: 'assessment', label: 'Avaliação', icon: User },
              { id: 'history', label: 'Histórico', icon: History },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'assessment') setActiveSection(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-teal-50 text-teal-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Toast */}
      {showSavedToast && (
        <div className="fixed top-16 right-4 z-50 bg-teal-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 no-print">
          <Save size={14} /> Avaliação salva!
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ══════════════════════════════════════════════════════
            ASSESSMENT TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'assessment' && (
          <div className="space-y-5">

            {/* ── Patient Data (always visible) ── */}
            <div className="card">
              <SectionHeader icon={User} title="Dados do Paciente" subtitle="Informações básicas para todas as avaliações" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="label">Nome completo</label>
                  <input type="text" value={patient.name} onChange={e => setPat('name', e.target.value)}
                    placeholder="Nome do paciente" className="input-field" />
                </div>
                <InputField label="Idade" id="age" value={patient.age} onChange={v => setPat('age', v)} placeholder="anos" min="1" max="120" step="1" suffix="anos" />
                <div>
                  <label className="label">Sexo</label>
                  <select className="input-field" value={patient.sex} onChange={e => setPat('sex', e.target.value)}>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
                <div>
                  <label className="label">Data da Avaliação</label>
                  <input type="date" className="input-field" value={patient.date} onChange={e => setPat('date', e.target.value)} />
                </div>
                <InputField label="Altura" id="height" value={patient.height} onChange={v => setPat('height', v)} placeholder="cm" min="50" max="250" suffix="cm" />
                <InputField label="Peso atual" id="weight" value={patient.weight} onChange={v => setPat('weight', v)} placeholder="kg" min="1" max="300" step="0.1" suffix="kg" />
                <div>
                  <label className="label">Nível de atividade</label>
                  <select className="input-field" value={patient.activityFactor} onChange={e => setPat('activityFactor', e.target.value)}>
                    {ACTIVITY_FACTORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── MENU (no section selected) or Section Navigation ── */}
            {activeSection === null ? (
              /* ── Dietbox-style landing menu ── */
              <DietboxMenu onSelect={(id) => setActiveSection(id)} />
            ) : (
              <>
                {/* Section Navigation tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-print">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border bg-gray-100 text-gray-500 hover:bg-gray-200 border-gray-200"
                  >
                    ← Menu
                  </button>
                  {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => !s.soon && setActiveSection(s.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                        s.soon
                          ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                          : activeSection === s.id
                            ? s.hero
                              ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-200'
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      <s.icon size={14} />
                      {s.label}
                      {s.hero && activeSection !== s.id && <Sparkles size={11} className="text-teal-500" />}
                      {s.soon && <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full ml-1">breve</span>}
                    </button>
                  ))}
                </div>

                {/* ══════════════════════════════════════════════════
                    ANAMNESE
                ══════════════════════════════════════════════════ */}
                {activeSection === 'anamnese' && (
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 p-6 text-white shadow-lg">
                      <div className="relative z-10">
                        <h2 className="text-2xl font-black mb-1">Anamnese</h2>
                        <p className="text-purple-100 text-sm max-w-md">
                          Histórico de saúde, hábitos alimentares e objetivos do paciente.
                        </p>
                      </div>
                      <div className="absolute right-4 top-4 opacity-10">
                        <User size={100} />
                      </div>
                    </div>
                    <AnamneseModule anamnese={anamnese} onChange={setAnamnese} />
                    <div className="flex flex-wrap gap-3 no-print">
                      <button className="btn-primary" onClick={handleSave}><Save size={15} /> Salvar Anamnese</button>
                      <button className="btn-secondary" onClick={() => setAnamnese({ ...DEFAULT_ANAMNESE })}><X size={15} /> Limpar</button>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                    AVALIAÇÃO 360° — HERO FEATURE
                ══════════════════════════════════════════════════ */}
                {activeSection === 'avaliacao360' && (
                  <div className="space-y-4">
                    {/* Hero banner */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 p-6 text-white shadow-lg shadow-teal-200">
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={18} className="text-teal-200" />
                          <span className="text-teal-200 text-sm font-semibold uppercase tracking-wider">Powered by IA</span>
                        </div>
                        <h2 className="text-2xl font-black mb-1">Avaliação 360°</h2>
                        <p className="text-teal-100 text-sm max-w-md">
                          Upload 2 fotos do paciente (frontal + lateral) e a IA analisa a composição corporal em segundos.
                          Sem equipamentos, sem dobras cutâneas.
                        </p>
                      </div>
                      <div className="absolute right-4 top-4 opacity-10">
                        <Camera size={100} />
                      </div>
                    </div>

                    {/* Photo upload */}
                    <div className="card">
                      <SectionHeader icon={Camera} title="Fotos do Paciente" subtitle="Frontal e lateral — boa iluminação, roupa justa" badge="Obrigatório" />
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                            <User size={12} /> Foto Frontal
                          </p>
                          <PhotoUploader
                            label="Vista Frontal"
                            icon={<User size={22} className="text-teal-500" />}
                            preview={frontalPreview}
                            onFile={handleFrontalFile}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                            <Eye size={12} /> Foto Lateral (direita)
                          </p>
                          <PhotoUploader
                            label="Vista Lateral"
                            icon={<Eye size={22} className="text-teal-500" />}
                            preview={lateralPreview}
                            onFile={handleLateralFile}
                          />
                        </div>
                      </div>

                      {/* Tips */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                        {['Boa iluminação', 'Roupa justa', 'Postura ereta', 'Fundo neutro'].map((tip, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                            <CheckCircle2 size={12} className="text-teal-500 flex-shrink-0" /> {tip}
                          </div>
                        ))}
                      </div>

                      {/* Analyze button */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleAnalyze}
                          disabled={aiLoading || (!frontalFile && !lateralFile)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                            aiLoading || (!frontalFile && !lateralFile)
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200 hover:shadow-lg'
                          }`}
                        >
                          {aiLoading
                            ? <><Loader2 size={16} className="animate-spin" /> {aiPhase === 'validating' ? 'Validando fotos...' : 'Analisando composição...'}</>
                            : <><Sparkles size={16} /> Analisar com IA</>}
                        </button>
                        {(frontalFile || lateralFile) && !aiLoading && (
                          <button onClick={() => {
                            setFrontalFile(null); setLateralFile(null);
                            setFrontalPreview(null); setLateralPreview(null);
                            setAiResult(null); setAiError(null);
                          }} className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 font-medium transition-colors">
                            <X size={14} /> Limpar
                          </button>
                        )}
                      </div>

                      {/* Error */}
                      {aiError && (
                        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold mb-1">⚠️ Problema detectado</p>
                            {aiError.split('\n').map((line, i) => (
                              <p key={i} className={line.startsWith('📷') ? 'font-medium' : ''}>{line}</p>
                            ))}
                            {aiError.includes('Fotos inadequadas') && (
                              <button
                                onClick={() => {
                                  setFrontalFile(null); setLateralFile(null);
                                  setFrontalPreview(null); setLateralPreview(null);
                                  setAiError(null);
                                }}
                                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-red-100 hover:bg-red-200 text-red-800 font-semibold transition-colors"
                              >
                                <Camera size={14} /> Trocar fotos
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Loading skeleton */}
                    {aiLoading && (
                      <div className="card">
                        <div className="flex items-center gap-3 mb-4">
                          <Loader2 size={20} className="animate-spin text-teal-600" />
                          <div>
                            <p className="font-semibold text-gray-800">Analisando composição corporal...</p>
                            <p className="text-xs text-gray-400">A IA está processando as fotos. Aguarde alguns segundos.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Result */}
                    {aiResult && !aiLoading && (
                      <div className="card">
                        <SectionHeader icon={Sparkles} title="Resultado — Avaliação 360°" subtitle="Análise gerada por Gemini Vision AI" badge="IA" />
                        <AIResultCard result={aiResult} weight={patient.weight} height={patient.height} sex={patient.sex} age={patient.age} />
                      </div>
                    )}

                    {/* IMC quick result (always, from weight/height) */}
                    {imc !== null && !aiResult && (
                      <div className="card">
                        <SectionHeader icon={BarChart2} title="Métricas Básicas" subtitle="Calculadas automaticamente com peso e altura" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <MetricCard title="IMC" value={fmt(imc, 1)} unit="kg/m²" classification={imcClass}
                            gauge={imc ? { value: imc, min: 15, max: 45, color: imcClass?.color } : null} icon={Activity} />
                          {rcq !== null && <MetricCard title="Cintura/Quadril" value={fmt(rcq, 2)} classification={rcqClass}
                            gauge={{ value: rcq, min: 0.6, max: 1.1, color: rcqClass?.color }} icon={Ruler} />}
                          {pesoIdeal && <MetricCard title="Peso Ideal" value={`${fmt(pesoIdeal.min,1)}–${fmt(pesoIdeal.max,1)}`} unit="kg"
                            note={`Para ${patient.height} cm`} icon={Activity} />}
                          {tmb && <MetricCard title="TMB" value={fmt(tmb, 0)} unit="kcal" icon={Activity} />}
                        </div>
                      </div>
                    )}

                    {/* Save / Share actions */}
                    <div className="flex flex-wrap gap-3 no-print">
                      <button className="btn-primary" onClick={handleSave}>
                        <Save size={15} /> Salvar Avaliação
                      </button>
                      {(aiResult || hasManualResults) && patient.name && (
                        <button onClick={() => setShareEntry({ patient, circumferences, skinfolds, anamnese, results: { imc, rcq, bf: aiResult?.bodyFatPercent ?? activeBF?.pct, tmb, get: get_, protocol, ai: aiResult }, savedAt: new Date().toISOString() })}
                          className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm border border-teal-200">
                          <Share2 size={15} /> Compartilhar com Paciente
                        </button>
                      )}
                      <button className="btn-secondary" onClick={() => window.print()}>
                        <Printer size={15} /> Imprimir
                      </button>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                    ANTROPOMÉTRICA
                ══════════════════════════════════════════════════ */}
                {activeSection === 'antropometrica' && (
                  <div className="space-y-4">
                    {/* Circumferences */}
                    <div className="card">
                      <SectionHeader icon={Ruler} title="Medidas Corporais" subtitle="Circunferências em centímetros (cm)" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <InputField label="Cintura" id="waist" value={circumferences.waist} onChange={v => setCirc('waist', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Quadril" id="hip" value={circumferences.hip} onChange={v => setCirc('hip', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Pescoço" id="neck" value={circumferences.neck} onChange={v => setCirc('neck', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Tórax" id="chest_c" value={circumferences.chest} onChange={v => setCirc('chest', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Braço D" id="armR" value={circumferences.armR} onChange={v => setCirc('armR', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Braço E" id="armL" value={circumferences.armL} onChange={v => setCirc('armL', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Coxa D" id="thighR" value={circumferences.thighR} onChange={v => setCirc('thighR', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Coxa E" id="thighL" value={circumferences.thighL} onChange={v => setCirc('thighL', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Panturrilha D" id="calfR" value={circumferences.calfR} onChange={v => setCirc('calfR', v)} suffix="cm" placeholder="0.0" />
                        <InputField label="Panturrilha E" id="calfL" value={circumferences.calfL} onChange={v => setCirc('calfL', v)} suffix="cm" placeholder="0.0" />
                      </div>
                    </div>

                    {/* Skinfolds */}
                    <div className="card">
                      <SectionHeader icon={Activity} title="Dobras Cutâneas" subtitle="Medidas em milímetros (mm) — optional"
                        collapsible open={skinfoldOpen} onToggle={() => setSkinfoldOpen(o => !o)} />
                      {skinfoldOpen && (
                        <>
                          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                            <span className="text-xs font-medium text-gray-600">Protocolo:</span>
                            {['3', '7'].map(p => (
                              <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="radio" name="protocol" value={p} checked={protocol === p} onChange={() => setProtocol(p)} className="accent-teal-600" />
                                <span>{p} dobras (Jackson &amp; Pollock)</span>
                              </label>
                            ))}
                          </div>
                          {protocol === '3' && (
                            <div>
                              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                                <Info size={12} />
                                {patient.sex === 'M' ? 'Homens: Peitoral + Abdominal + Coxa' : 'Mulheres: Tríceps + Suprailíaca + Coxa'}
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {patient.sex === 'F' && <InputField label="Tríceps *" id="triceps" value={skinfolds.triceps} onChange={v => setSkin('triceps', v)} suffix="mm" placeholder="0.0" />}
                                {patient.sex === 'M' && <InputField label="Peitoral *" id="chest_sf" value={skinfolds.chest} onChange={v => setSkin('chest', v)} suffix="mm" placeholder="0.0" />}
                                {patient.sex === 'M' && <InputField label="Abdominal *" id="abdominal" value={skinfolds.abdominal} onChange={v => setSkin('abdominal', v)} suffix="mm" placeholder="0.0" />}
                                {patient.sex === 'F' && <InputField label="Suprailíaca *" id="suprailiac" value={skinfolds.suprailiac} onChange={v => setSkin('suprailiac', v)} suffix="mm" placeholder="0.0" />}
                                <InputField label="Coxa *" id="thigh_sf" value={skinfolds.thigh} onChange={v => setSkin('thigh', v)} suffix="mm" placeholder="0.0" />
                              </div>
                            </div>
                          )}
                          {protocol === '7' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {[['triceps','Tríceps'],['biceps','Bíceps'],['subscapular','Subescapular'],['suprailiac','Suprailíaca'],['abdominal','Abdominal'],['thigh','Coxa'],['chest','Peitoral']].map(([k,l]) => (
                                <InputField key={k} label={l} id={k} value={skinfolds[k]} onChange={v => setSkin(k, v)} suffix="mm" placeholder="0.0" />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Manual results */}
                    {hasManualResults && (
                      <div className="card">
                        <SectionHeader icon={BarChart2} title="Resultados Antropométricos" subtitle="Calculados com base nas medidas manuais" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                          <MetricCard title="IMC" value={fmt(imc, 1)} unit="kg/m²" classification={imcClass}
                            gauge={imc ? { value: imc, min: 15, max: 45, color: imcClass?.color } : null} icon={Activity} />
                          <MetricCard title="Cintura/Quadril (RCQ)" value={fmt(rcq, 2)} classification={rcqClass}
                            gauge={rcq ? { value: rcq, min: 0.6, max: 1.1, color: rcqClass?.color } : null} icon={Ruler} />
                          {activeBF && <MetricCard title={`% Gordura (${activeBF.protocol})`} value={fmt(activeBF.pct, 1)} unit="%" classification={bfClass}
                            gauge={{ value: activeBF.pct, min: 5, max: 45, color: bfClass?.color }} icon={Activity}
                            note={`Soma: ${fmt(activeBF.sum3 ?? activeBF.sum7, 1)} mm · D: ${fmt(activeBF.density, 4)}`} />}
                          {tmb && <MetricCard title="TMB" value={fmt(tmb, 0)} unit="kcal" icon={Activity} />}
                        </div>
                        {bodyComp && (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <MetricCard title="Massa Gorda" value={fmt(bodyComp.fatMass, 1)} unit="kg" />
                            <MetricCard title="Massa Magra" value={fmt(bodyComp.leanMass, 1)} unit="kg" />
                            {get_ && <MetricCard title="GET" value={fmt(get_, 0)} unit="kcal/dia" />}
                            {pesoIdeal && <MetricCard title="Peso Ideal" value={`${fmt(pesoIdeal.min,1)}–${fmt(pesoIdeal.max,1)}`} unit="kg"
                              note={`Para ${patient.height} cm`} />}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 no-print">
                      <button className="btn-primary" onClick={handleSave}><Save size={15} /> Salvar</button>
                      <button className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
                      <button className="btn-secondary" onClick={() => {
                        setCircumferences({ waist: '', hip: '', neck: '', chest: '', armR: '', armL: '', thighR: '', thighL: '', calfR: '', calfL: '' });
                        setSkinfolds({ triceps: '', biceps: '', subscapular: '', suprailiac: '', abdominal: '', thigh: '', chest: '' });
                      }}><X size={15} /> Limpar medidas</button>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════
                    GASTOS ENERGÉTICOS
                ══════════════════════════════════════════════════ */}
                {activeSection === 'energetico' && (
                  <div className="space-y-4">
                    <div className="card">
                      <SectionHeader icon={Zap} title="Gastos Energéticos" subtitle="Baseado em Harris-Benedict (1984) + fator de atividade" />
                      {tmb ? (
                        <>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            <MetricCard title="TMB — Taxa Metabólica Basal" value={fmt(tmb, 0)} unit="kcal/dia" highlight icon={Zap}
                              note="Calorias mínimas em repouso total" />
                            {get_ && <MetricCard title="GET — Gasto Energético Total" value={fmt(get_, 0)} unit="kcal/dia" highlight icon={Activity}
                              note={`Fator atividade: ×${patient.activityFactor}`} />}
                            {pesoIdeal && <MetricCard title="Peso Ideal" value={`${fmt(pesoIdeal.min,1)}–${fmt(pesoIdeal.max,1)}`} unit="kg" icon={User}
                              note="IMC 18.5–24.9" />}
                          </div>
                          {get_ && (
                            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-3">Metas calóricas orientativas</p>
                              <div className="grid grid-cols-3 gap-3">
                                {[
                                  { label: '🔻 Perda de peso', val: get_ * 0.8, note: '-20% do GET' },
                                  { label: '⚖️ Manutenção', val: get_, note: '= GET' },
                                  { label: '💪 Ganho de massa', val: get_ * 1.15, note: '+15% do GET' },
                                ].map((g, i) => (
                                  <div key={i} className="bg-white rounded-lg p-3 text-center shadow-sm">
                                    <p className="text-xs text-gray-500 mb-1">{g.label}</p>
                                    <p className="text-xl font-black text-teal-700">{fmt(g.val, 0)}</p>
                                    <p className="text-xs text-gray-400">kcal/dia · {g.note}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Zap size={36} className="text-gray-200 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">Preencha peso, altura e idade para calcular.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Coming soon sections */}
                {activeSection === 'preconsulta' && <ComingSoon title="Questionário Pré Consulta" icon={ClipboardList} description="Questionário para ser respondido pelo paciente antes da consulta." />}
                {activeSection === 'laboratorial' && <ComingSoon title="Exames Laboratoriais" icon={FlaskConical} description="Integração com resultados de exames de sangue, hormônios e perfil lipídico." />}
                {activeSection === 'recordatorio' && <ComingSoon title="Recordatório Alimentar" icon={BookOpen} description="Registro e análise do consumo alimentar de 24h ou 3 dias." />}
                {activeSection === 'plano' && (
                  <MealPlanModule
                    patient={patient}
                    anamnese={anamnese}
                    energyData={{ tmb, get: get_ }}
                  />
                )}
              </>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            HISTORY TAB
        ══════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Histórico de Avaliações</h2>
                <p className="text-sm text-gray-400">{history.length} avaliação{history.length !== 1 ? 'ões' : ''} salva{history.length !== 1 ? 's' : ''}</p>
              </div>
              {history.length > 0 && (
                <button className="btn-danger" onClick={() => { if (confirm('Apagar todo o histórico?')) { clearHistory(); setHistory([]); } }}>
                  <Trash2 size={14} /> Limpar tudo
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="card text-center py-12">
                <History size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nenhuma avaliação salva ainda.</p>
                <button className="btn-primary mt-4 mx-auto" onClick={() => setActiveTab('assessment')}>
                  <User size={14} /> Criar primeira avaliação
                </button>
              </div>
            ) : (
              <>
                {/* Evolution charts */}
                {(() => {
                  const byName = {};
                  history.forEach(e => { const n = e.patient?.name || 'Sem nome'; if (!byName[n]) byName[n] = []; byName[n].push(e); });
                  const multi = Object.entries(byName).filter(([, arr]) => arr.length >= 2);
                  if (!multi.length) return null;
                  return (
                    <div className="card">
                      <SectionHeader icon={TrendingUp} title="Evolução" subtitle="Pacientes com múltiplas avaliações" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {multi.map(([name, entries]) => {
                          const sorted = [...entries].reverse();
                          const wData = sorted.map(e => ({ date: e.savedAt, value: parseFloat(e.patient?.weight) || null }));
                          const bData = sorted.map(e => ({ date: e.savedAt, value: e.results?.bf ?? null }));
                          return (
                            <div key={name} className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm font-semibold text-gray-700 mb-3">{name}</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Peso (kg)</p>
                                  <MiniLineChart data={wData} />
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-bold">{fmt(wData[wData.length - 1]?.value, 1)}</span>
                                    <DeltaBadge current={wData[wData.length-1]?.value} previous={wData[wData.length-2]?.value} unit="kg" inverse decimals={1} />
                                  </div>
                                </div>
                                {bData.some(d => d.value != null) && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">% Gordura</p>
                                    <MiniLineChart data={bData} color="#f59e0b" />
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm font-bold">{fmt(bData[bData.length-1]?.value, 1)}%</span>
                                      <DeltaBadge current={bData[bData.length-1]?.value} previous={bData[bData.length-2]?.value} unit="%" inverse decimals={1} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* List */}
                <div className="space-y-3">
                  {history.map((entry, idx) => {
                    const prev = history[idx + 1];
                    const samePatient = prev && prev.patient?.name === entry.patient?.name;
                    const hasAI = !!entry.results?.ai;
                    const hasAnamnese = !!entry.anamnese?.objetivo;
                    return (
                      <div key={entry.id} className={`card hover:border-teal-100 transition-colors ${hasAI ? 'border-teal-100' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-gray-800">{entry.patient?.name || 'Sem nome'}</span>
                              <span className="text-xs text-gray-400">{entry.patient?.sex === 'M' ? 'Masculino' : 'Feminino'} · {entry.patient?.age} anos</span>
                              {hasAI && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Sparkles size={10} />IA 360°</span>}
                              {hasAnamnese && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><User size={10} />Anamnese</span>}
                            </div>
                            <p className="text-xs text-gray-400 mb-3">{formatDate(entry.savedAt)}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs text-gray-400">Peso</p>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">{entry.patient?.weight} kg</span>
                                  {samePatient && <DeltaBadge current={parseFloat(entry.patient?.weight)} previous={parseFloat(prev.patient?.weight)} unit="kg" inverse decimals={1} />}
                                </div>
                              </div>
                              {entry.results?.imc && (
                                <div>
                                  <p className="text-xs text-gray-400">IMC</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{fmt(entry.results.imc, 1)}</span>
                                    {samePatient && entry.results?.imc && prev.results?.imc && <DeltaBadge current={entry.results.imc} previous={prev.results.imc} inverse decimals={1} />}
                                  </div>
                                </div>
                              )}
                              {entry.results?.bf != null && (
                                <div>
                                  <p className="text-xs text-gray-400">% Gordura {hasAI ? '(IA)' : ''}</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{fmt(entry.results.bf, 1)}%</span>
                                    {samePatient && entry.results?.bf != null && prev.results?.bf != null && <DeltaBadge current={entry.results.bf} previous={prev.results.bf} unit="%" inverse decimals={1} />}
                                  </div>
                                </div>
                              )}
                              {entry.results?.tmb && (
                                <div>
                                  <p className="text-xs text-gray-400">TMB</p>
                                  <span className="font-semibold">{fmt(entry.results.tmb, 0)} kcal</span>
                                </div>
                              )}
                              {hasAnamnese && (
                                <div className="sm:col-span-2">
                                  <p className="text-xs text-gray-400">Objetivo</p>
                                  <span className="font-semibold text-purple-700">{entry.anamnese.objetivo}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button onClick={() => loadFromHistory(entry)} className="text-xs text-teal-600 hover:text-teal-700 font-medium bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors">Carregar</button>
                            <button onClick={() => setShareEntry(entry)} className="text-xs text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-1.5 rounded-lg transition-colors" title="Compartilhar"><Share2 size={13} /></button>
                            <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-100 py-5 text-center no-print">
        <p className="text-xs text-gray-400">NutriAssess — Avaliação Física Profissional | Powered by CaffaroAI</p>
        <p className="text-xs text-gray-300 mt-1">Fórmulas: Jackson & Pollock (1978) · Harris-Benedict (1984) · Siri (1956) · OMS</p>
      </footer>

      {/* Share Modal */}
      {shareEntry && <ShareModal assessment={shareEntry} onClose={() => setShareEntry(null)} />}
    </div>
  );
}
