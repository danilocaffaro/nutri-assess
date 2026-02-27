import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LZString from 'lz-string';
import { Activity, User, Ruler, BarChart2, AlertTriangle, Printer, Share2, Heart } from 'lucide-react';
import {
  calcIMC, classifyIMC,
  calcRCQ, classifyRCQ,
  calcBodyFatJP3, calcBodyFatJP7, classifyBodyFat,
  calcBodyComposition,
  calcTMB, calcGET,
  calcPesoIdeal,
  fmt, colorText, colorBg,
} from './utils/calculations';

// ─── Gauge Semicircle ────────────────────────────────────────────
function SemiGauge({ value, min, max, color, label, unit }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const angle = -135 + (pct / 100) * 270;
  const colorMap = {
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    gray: '#9ca3af',
  };
  const c = colorMap[color] || colorMap.gray;

  // SVG arc math
  const cx = 60, cy = 60, r = 48;
  const startAngle = -135 * (Math.PI / 180);
  const endAngle = 135 * (Math.PI / 180);
  const activeEnd = (angle) * (Math.PI / 180);

  const polarToXY = (a, radius) => ({
    x: cx + radius * Math.cos(a),
    y: cy + radius * Math.sin(a),
  });

  const s = polarToXY(startAngle, r);
  const e = polarToXY(endAngle, r);
  const ap = polarToXY(activeEnd, r);

  const arcPath = (from, to, large) => {
    const f = polarToXY(from, r);
    const t = polarToXY(to, r);
    const lg = large ? 1 : 0;
    return `M ${f.x} ${f.y} A ${r} ${r} 0 ${lg} 1 ${t.x} ${t.y}`;
  };

  const totalArc = 270;
  const activeArc = (pct / 100) * totalArc;
  const largeArcBg = 1;
  const largeArcFg = activeArc > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="80" viewBox="0 0 120 100">
        {/* BG track */}
        <path
          d={arcPath(startAngle, endAngle, true)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Active track */}
        {pct > 0 && (
          <path
            d={arcPath(startAngle, activeEnd, largeArcFg)}
            fill="none"
            stroke={c}
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
        {/* Needle dot */}
        <circle cx={ap.x} cy={ap.y} r={5} fill={c} />
        {/* Value */}
        <text x="60" y="72" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1f2937">
          {fmt(value, 1)}
        </text>
        <text x="60" y="84" textAnchor="middle" fontSize="8" fill="#9ca3af">
          {unit}
        </text>
      </svg>
    </div>
  );
}

// ─── Metric Block (patient view) ────────────────────────────────
function MetricBlock({ title, value, unit, classification, gauge, note, large }) {
  const colorMap = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
    yellow: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
  };
  const c = colorMap[classification?.color] || colorMap.gray;

  return (
    <div className={`rounded-2xl border-2 p-5 ${classification ? `${c.bg} ${c.border}` : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        {classification && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
            {classification.label}
          </span>
        )}
      </div>

      {gauge ? (
        <div className="flex flex-col items-center -mt-2">
          <SemiGauge
            value={parseFloat(value)}
            min={gauge.min}
            max={gauge.max}
            color={classification?.color}
            unit={unit}
          />
        </div>
      ) : (
        <div className={`${large ? 'text-4xl' : 'text-3xl'} font-black mt-1 ${classification ? colorText(classification.color) : 'text-gray-800'}`}>
          {value}
          <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>
        </div>
      )}
      {note && <p className="text-xs text-gray-500 mt-2">{note}</p>}
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────
function ProgressBar({ label, value, max, color, suffix }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorMap = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-400',
    red: 'bg-red-500',
    teal: 'bg-teal-500',
    blue: 'bg-blue-500',
  };
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-800">{fmt(value, 1)} {suffix}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${colorMap[color] || 'bg-teal-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Icon size={16} className="text-teal-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PATIENT PORTAL
// ═══════════════════════════════════════════════════════════════
export default function PatientPortal() {
  const { data: encodedData } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      if (!encodedData) throw new Error('Link inválido');
      const decoded = LZString.decompressFromEncodedURIComponent(encodedData);
      if (!decoded) throw new Error('Dados corrompidos');
      const parsed = JSON.parse(decoded);
      setAssessment(parsed);
    } catch (e) {
      setError(e.message || 'Não foi possível carregar os dados');
    }
  }, [encodedData]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Inválido</h2>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-400 text-xs mt-3">Solicite um novo link ao seu nutricionista.</p>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando sua avaliação...</p>
        </div>
      </div>
    );
  }

  const { patient, circumferences, skinfolds, results, nutricionista, savedAt } = assessment;

  // Recalculate everything from raw data
  const imc = calcIMC(parseFloat(patient.weight), parseFloat(patient.height));
  const imcClass = classifyIMC(imc);
  const rcq = calcRCQ(parseFloat(circumferences?.waist), parseFloat(circumferences?.hip));
  const rcqClass = classifyRCQ(rcq, patient.sex);
  const protocol = results?.protocol;
  const activeBF = protocol === '7'
    ? calcBodyFatJP7(skinfolds || {}, patient.sex, parseFloat(patient.age))
    : calcBodyFatJP3(skinfolds || {}, patient.sex, parseFloat(patient.age));
  const bfClass = activeBF ? classifyBodyFat(activeBF.pct, patient.sex) : null;
  const bodyComp = activeBF ? calcBodyComposition(parseFloat(patient.weight), activeBF.pct) : null;
  const tmb = calcTMB(parseFloat(patient.weight), parseFloat(patient.height), parseFloat(patient.age), patient.sex);
  const get_ = calcGET(tmb, parseFloat(patient.activityFactor));
  const pesoIdeal = calcPesoIdeal(parseFloat(patient.height));

  const dateFormatted = savedAt
    ? new Date(savedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : patient.date;

  const hasCirc = circumferences && (circumferences.waist || circumferences.hip || circumferences.armR || circumferences.calfR);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 50%, #f0f9ff 100%)' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-sm">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm block leading-tight">NutriAssess</span>
              <span className="text-xs text-gray-400">Portal do Paciente</span>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 px-3 py-2 rounded-lg transition-colors no-print"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Baixar PDF</span>
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-12">
        {/* Patient card */}
        <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <User size={26} className="text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-gray-900 leading-tight truncate">{patient.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="text-sm text-gray-500">{patient.sex === 'M' ? 'Masculino' : 'Feminino'} · {patient.age} anos</span>
                <span className="text-sm text-gray-500">{patient.weight} kg · {patient.height} cm</span>
              </div>
              <p className="text-xs text-teal-600 font-medium mt-1.5">📅 Avaliado em {dateFormatted}</p>
            </div>
          </div>
        </div>

        {/* ── Métricas Principais ── */}
        <Section title="Métricas Principais" icon={BarChart2}>
          <div className="grid grid-cols-2 gap-3">
            {imc !== null && (
              <MetricBlock
                title="IMC"
                value={fmt(imc, 1)}
                unit="kg/m²"
                classification={imcClass}
                gauge={{ min: 15, max: 40 }}
              />
            )}
            {rcq !== null && (
              <MetricBlock
                title="Cintura / Quadril"
                value={fmt(rcq, 2)}
                classification={rcqClass}
                gauge={{ min: 0.6, max: 1.1 }}
              />
            )}
            {activeBF && (
              <MetricBlock
                title={`% Gordura Corporal`}
                value={fmt(activeBF.pct, 1)}
                unit="%"
                classification={bfClass}
                gauge={{ min: 5, max: 45 }}
                note={`Protocolo: ${activeBF.protocol}`}
              />
            )}
            {tmb !== null && (
              <MetricBlock
                title="Metabolismo Basal"
                value={fmt(tmb, 0)}
                unit="kcal"
                note="Taxa Metabólica Basal (Harris-Benedict)"
              />
            )}
          </div>

          {get_ !== null && (
            <div className="mt-3 bg-teal-50 rounded-2xl border-2 border-teal-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Gasto Energético Total</p>
                  <p className="text-4xl font-black text-teal-700">{fmt(get_, 0)} <span className="text-lg font-normal text-teal-500">kcal/dia</span></p>
                </div>
                <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center">
                  <Activity size={24} className="text-teal-600" />
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Composição Corporal ── */}
        {bodyComp && (
          <Section title="Composição Corporal" icon={Activity}>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
              <ProgressBar
                label="Massa Gorda"
                value={bodyComp.fatMass}
                max={parseFloat(patient.weight)}
                color={bfClass?.color || 'yellow'}
                suffix="kg"
              />
              <ProgressBar
                label="Massa Magra"
                value={bodyComp.leanMass}
                max={parseFloat(patient.weight)}
                color="teal"
                suffix="kg"
              />
              {pesoIdeal && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Faixa de Peso Saudável</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {fmt(pesoIdeal.min, 1)} – {fmt(pesoIdeal.max, 1)} <span className="text-base font-normal text-gray-400">kg</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Para sua altura de {patient.height} cm (IMC 18.5–24.9)</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Medidas Corporais ── */}
        {hasCirc && (
          <Section title="Medidas Corporais" icon={Ruler}>
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                {[
                  { key: 'waist', label: 'Cintura' },
                  { key: 'hip', label: 'Quadril' },
                  { key: 'neck', label: 'Pescoço' },
                  { key: 'chest', label: 'Tórax' },
                  { key: 'armR', label: 'Braço Direito' },
                  { key: 'armL', label: 'Braço Esquerdo' },
                  { key: 'thighR', label: 'Coxa Direita' },
                  { key: 'thighL', label: 'Coxa Esquerda' },
                  { key: 'calfR', label: 'Panturrilha D' },
                  { key: 'calfL', label: 'Panturrilha E' },
                ].map(({ key, label }) =>
                  circumferences[key] ? (
                    <div key={key}>
                      <p className="text-xs text-gray-400 font-medium">{label}</p>
                      <p className="text-xl font-bold text-gray-800">{circumferences[key]} <span className="text-sm font-normal text-gray-400">cm</span></p>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </Section>
        )}

        {/* ── Observações / Classificações ── */}
        <Section title="Resumo & Classificações" icon={Heart}>
          <div className="space-y-3">
            {[
              imc !== null && { label: 'IMC', value: fmt(imc, 1), unit: 'kg/m²', cls: imcClass },
              rcq !== null && { label: 'Relação Cintura-Quadril', value: fmt(rcq, 2), cls: rcqClass },
              activeBF && { label: '% Gordura Corporal', value: fmt(activeBF.pct, 1), unit: '%', cls: bfClass },
            ].filter(Boolean).map((item, i) => {
              if (!item) return null;
              const colorMap = {
                green: { bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
                yellow: { bar: 'bg-amber-400', text: 'text-amber-700', light: 'bg-amber-50' },
                red: { bar: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
              };
              const c = colorMap[item.cls?.color] || { bar: 'bg-gray-400', text: 'text-gray-700', light: 'bg-gray-50' };
              return (
                <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${c.light}`}>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-black text-gray-800 mt-0.5">{item.value} <span className="text-sm font-normal text-gray-400">{item.unit}</span></p>
                  </div>
                  {item.cls && (
                    <span className={`font-bold text-sm ${c.text}`}>{item.cls.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center">
            <Activity size={12} className="text-white" />
          </div>
          <span className="font-bold text-gray-700 text-sm">NutriAssess</span>
        </div>
        {nutricionista && (
          <p className="text-xs text-gray-500">Avaliação realizada por <strong>{nutricionista}</strong></p>
        )}
        <p className="text-xs text-gray-400 mt-1">Powered by NutriAssess — CaffaroAI</p>
        <p className="text-xs text-gray-300 mt-1">Fórmulas: Jackson & Pollock (1978) · Harris-Benedict (1984) · Siri (1956)</p>
      </footer>
    </div>
  );
}
