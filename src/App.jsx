import React, { useState, useEffect, useCallback } from 'react';
import { Activity, User, Ruler, BarChart2, History, Printer, Save, ChevronDown, ChevronUp, Info, Trash2, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

// ─── Gauge Component ────────────────────────────────────────────
function GaugeBar({ value, min, max, color, label }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="mt-1">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colorBg(color)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────
function MetricCard({ title, value, unit, classification, gauge, icon: Icon, note }) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          {Icon && <Icon size={13} />}
          {title}
        </div>
        {classification && (
          <span className={colorClass(classification.color)}>{classification.label}</span>
        )}
      </div>
      <div className={`text-2xl font-bold ${classification ? colorText(classification.color) : 'text-gray-800'}`}>
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </div>
      {gauge && <GaugeBar {...gauge} />}
      {note && <p className="text-xs text-gray-400 mt-1.5">{note}</p>}
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, collapsible, open, onToggle }) {
  return (
    <div
      className={`flex items-center justify-between mb-4 ${collapsible ? 'cursor-pointer' : ''}`}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
          <Icon size={16} className="text-teal-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {collapsible && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
    </div>
  );
}

// ─── Input Field ────────────────────────────────────────────────
function InputField({ label, id, type = 'number', value, onChange, placeholder, min, max, step, className = '', suffix }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step || '0.1'}
          className={`input-field ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ─── Delta Badge ─────────────────────────────────────────────────
function DeltaBadge({ current, previous, unit = '', inverse = false, decimals = 1 }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return <span className="badge-gray">= {fmt(current, decimals)} {unit}</span>;
  const positive = delta > 0;
  const good = inverse ? !positive : positive;
  const sign = positive ? '+' : '';
  return (
    <span className={positive !== inverse ? 'badge-red' : 'badge-green'}>
      {positive ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
      {sign}{fmt(delta, decimals)} {unit}
    </span>
  );
}

// ─── Evolution Mini Chart (CSS) ──────────────────────────────────
function MiniLineChart({ data, color = '#0D9488' }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.value).filter(v => v != null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200, H = 50, pad = 4;
  const points = data
    .filter(d => d.value != null)
    .map((d, i, arr) => {
      const x = pad + (i / (arr.length - 1)) * (W - 2 * pad);
      const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.filter(d => d.value != null).map((d, i, arr) => {
        const x = pad + (i / (arr.length - 1)) * (W - 2 * pad);
        const y = H - pad - ((d.value - min) / range) * (H - 2 * pad);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState('assessment');
  const [history, setHistory] = useState([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [skinfoldOpen, setSkinfoldOpen] = useState(true);
  const [protocol, setProtocol] = useState('3');

  // Form state
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

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

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

  const hasResults = imc !== null || rcq !== null || activeBF !== null || tmb !== null;

  // ── Save assessment ───────────────────────────────────────────
  const handleSave = () => {
    if (!patient.name || !patient.weight || !patient.height) {
      alert('Preencha pelo menos: nome, peso e altura.');
      return;
    }
    const entry = saveAssessment({
      patient, circumferences, skinfolds,
      results: { imc, rcq, bf: activeBF?.pct, tmb, get: get_, protocol },
    });
    setHistory(loadHistory());
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleDelete = (id) => {
    if (confirm('Remover esta avaliação?')) {
      setHistory(deleteAssessment(id));
    }
  };

  const handlePrint = () => window.print();

  const setPat = (key, val) => setPatient(p => ({ ...p, [key]: val }));
  const setCirc = (key, val) => setCircumferences(c => ({ ...c, [key]: val }));
  const setSkin = (key, val) => setSkinfolds(s => ({ ...s, [key]: val }));

  const loadFromHistory = (entry) => {
    setPatient(entry.patient);
    setCircumferences(entry.circumferences);
    setSkinfolds(entry.skinfolds);
    setProtocol(entry.results?.protocol === '7 dobras (J&P)' ? '7' : '3');
    setActiveTab('assessment');
    window.scrollTo(0, 0);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 no-print">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">NutriAssess</span>
              <span className="text-xs text-gray-400 block leading-none">Avaliação Física Corporal</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {[
              { id: 'assessment', label: 'Avaliação', icon: User },
              { id: 'history', label: 'Histórico', icon: History },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
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
          <Save size={14} />
          Avaliação salva com sucesso!
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ASSESSMENT TAB */}
        {activeTab === 'assessment' && (
          <div className="space-y-5">
            {/* Print header (only shows on print) */}
            <div className="hidden print:block mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">NutriAssess</h1>
                  <p className="text-sm text-gray-500">Avaliação Física Corporal Profissional</p>
                </div>
              </div>
              {patient.name && <p className="text-sm text-gray-600">Paciente: <strong>{patient.name}</strong> | Data: {patient.date}</p>}
            </div>

            {/* 1. Dados do Paciente */}
            <div className="card">
              <SectionHeader icon={User} title="Dados do Paciente" subtitle="Informações básicas para a avaliação" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="label">Nome completo</label>
                  <input
                    type="text"
                    value={patient.name}
                    onChange={e => setPat('name', e.target.value)}
                    placeholder="Nome do paciente"
                    className="input-field"
                  />
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
                <InputField label="Altura" id="height" value={patient.height} onChange={v => setPat('height', v)} placeholder="cm" min="50" max="250" step="0.5" suffix="cm" />
                <InputField label="Peso atual" id="weight" value={patient.weight} onChange={v => setPat('weight', v)} placeholder="kg" min="1" max="300" step="0.1" suffix="kg" />
                <div>
                  <label className="label">Nível de atividade</label>
                  <select className="input-field" value={patient.activityFactor} onChange={e => setPat('activityFactor', e.target.value)}>
                    {ACTIVITY_FACTORS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Medidas Corporais */}
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

            {/* 3. Dobras Cutâneas */}
            <div className="card">
              <SectionHeader
                icon={Activity}
                title="Dobras Cutâneas"
                subtitle="Medidas em milímetros (mm) — opcional"
                collapsible
                open={skinfoldOpen}
                onToggle={() => setSkinfoldOpen(o => !o)}
              />
              {skinfoldOpen && (
                <>
                  <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-medium text-gray-600">Protocolo:</span>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="protocol" value="3" checked={protocol === '3'} onChange={() => setProtocol('3')} className="accent-teal-600" />
                      <span>3 dobras (Jackson &amp; Pollock)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="protocol" value="7" checked={protocol === '7'} onChange={() => setProtocol('7')} className="accent-teal-600" />
                      <span>7 dobras (Jackson &amp; Pollock)</span>
                    </label>
                  </div>

                  {protocol === '3' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <Info size={12} />
                        {patient.sex === 'M'
                          ? 'Homens 3 dobras: Peitoral + Abdominal + Coxa'
                          : 'Mulheres 3 dobras: Tríceps + Suprailíaca + Coxa'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {patient.sex === 'F' && (
                          <InputField label="Tríceps *" id="triceps" value={skinfolds.triceps} onChange={v => setSkin('triceps', v)} suffix="mm" placeholder="0.0" />
                        )}
                        {patient.sex === 'M' && (
                          <InputField label="Peitoral *" id="chest_sf" value={skinfolds.chest} onChange={v => setSkin('chest', v)} suffix="mm" placeholder="0.0" />
                        )}
                        {patient.sex === 'M' && (
                          <InputField label="Abdominal *" id="abdominal" value={skinfolds.abdominal} onChange={v => setSkin('abdominal', v)} suffix="mm" placeholder="0.0" />
                        )}
                        {patient.sex === 'F' && (
                          <InputField label="Suprailíaca *" id="suprailiac" value={skinfolds.suprailiac} onChange={v => setSkin('suprailiac', v)} suffix="mm" placeholder="0.0" />
                        )}
                        <InputField label="Coxa *" id="thigh_sf" value={skinfolds.thigh} onChange={v => setSkin('thigh', v)} suffix="mm" placeholder="0.0" />
                      </div>
                    </div>
                  )}

                  {protocol === '7' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      <InputField label="Tríceps" id="triceps7" value={skinfolds.triceps} onChange={v => setSkin('triceps', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Bíceps" id="biceps7" value={skinfolds.biceps} onChange={v => setSkin('biceps', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Subescapular" id="subscapular7" value={skinfolds.subscapular} onChange={v => setSkin('subscapular', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Suprailíaca" id="suprailiac7" value={skinfolds.suprailiac} onChange={v => setSkin('suprailiac', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Abdominal" id="abdominal7" value={skinfolds.abdominal} onChange={v => setSkin('abdominal', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Coxa" id="thigh7" value={skinfolds.thigh} onChange={v => setSkin('thigh', v)} suffix="mm" placeholder="0.0" />
                      <InputField label="Peitoral" id="chest7" value={skinfolds.chest} onChange={v => setSkin('chest', v)} suffix="mm" placeholder="0.0" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 4. Resultados */}
            {hasResults && (
              <div className="card">
                <SectionHeader icon={BarChart2} title="Resultados" subtitle="Calculados automaticamente com base nos dados informados" />

                {/* Primary metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <MetricCard
                    title="IMC"
                    value={fmt(imc, 1)}
                    unit="kg/m²"
                    classification={imcClass}
                    gauge={imc ? { value: imc, min: 15, max: 45, color: imcClass?.color } : null}
                    icon={Activity}
                  />
                  <MetricCard
                    title="Cintura/Quadril (RCQ)"
                    value={fmt(rcq, 2)}
                    classification={rcqClass}
                    gauge={rcq ? { value: rcq, min: 0.6, max: 1.1, color: rcqClass?.color } : null}
                    icon={Ruler}
                  />
                  {activeBF && (
                    <MetricCard
                      title={`% Gordura (${activeBF.protocol})`}
                      value={fmt(activeBF.pct, 1)}
                      unit="%"
                      classification={bfClass}
                      gauge={{ value: activeBF.pct, min: 5, max: 45, color: bfClass?.color }}
                      icon={Activity}
                      note={`Soma: ${fmt(activeBF.sum3 ?? activeBF.sum7, 1)} mm | D: ${fmt(activeBF.density, 4)}`}
                    />
                  )}
                  {tmb && (
                    <MetricCard
                      title="TMB (Harris-Benedict)"
                      value={fmt(tmb, 0)}
                      unit="kcal"
                      icon={Activity}
                    />
                  )}
                </div>

                {/* Secondary metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {bodyComp && (
                    <>
                      <MetricCard title="Massa Gorda" value={fmt(bodyComp.fatMass, 1)} unit="kg" />
                      <MetricCard title="Massa Magra" value={fmt(bodyComp.leanMass, 1)} unit="kg" />
                    </>
                  )}
                  {get_ && (
                    <MetricCard title="GET (Gasto Energético Total)" value={fmt(get_, 0)} unit="kcal/dia" />
                  )}
                  {pesoIdeal && (
                    <MetricCard
                      title="Peso Ideal (IMC 18.5–24.9)"
                      value={`${fmt(pesoIdeal.min, 1)} – ${fmt(pesoIdeal.max, 1)}`}
                      unit="kg"
                      note={`Para altura de ${patient.height} cm`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 no-print">
              <button className="btn-primary" onClick={handleSave}>
                <Save size={15} />
                Salvar Avaliação
              </button>
              <button className="btn-secondary" onClick={handlePrint}>
                <Printer size={15} />
                Imprimir / PDF
              </button>
              <button className="btn-secondary" onClick={() => {
                setPatient({ name: '', age: '', sex: 'F', date: new Date().toISOString().split('T')[0], height: '', weight: '', activityFactor: '1.55' });
                setCircumferences({ waist: '', hip: '', neck: '', chest: '', armR: '', armL: '', thighR: '', thighL: '', calfR: '', calfL: '' });
                setSkinfolds({ triceps: '', biceps: '', subscapular: '', suprailiac: '', abdominal: '', thigh: '', chest: '' });
              }}>
                <X size={15} />
                Nova Avaliação
              </button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Histórico de Avaliações</h2>
                <p className="text-sm text-gray-400">{history.length} avaliação{history.length !== 1 ? 'ões' : ''} salva{history.length !== 1 ? 's' : ''}</p>
              </div>
              {history.length > 0 && (
                <button className="btn-danger" onClick={() => { if (confirm('Apagar todo o histórico?')) { clearHistory(); setHistory([]); } }}>
                  <Trash2 size={14} />
                  Limpar tudo
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="card text-center py-12">
                <History size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nenhuma avaliação salva ainda.</p>
                <button className="btn-primary mt-4 mx-auto" onClick={() => setActiveTab('assessment')}>
                  <User size={14} />
                  Criar primeira avaliação
                </button>
              </div>
            ) : (
              <>
                {/* Evolution mini-charts for patients with 2+ entries */}
                {(() => {
                  const byName = {};
                  history.forEach(e => {
                    const n = e.patient?.name || 'Sem nome';
                    if (!byName[n]) byName[n] = [];
                    byName[n].push(e);
                  });
                  const multiEntry = Object.entries(byName).filter(([, arr]) => arr.length >= 2);
                  if (!multiEntry.length) return null;
                  return (
                    <div className="card">
                      <SectionHeader icon={TrendingUp} title="Evolução" subtitle="Pacientes com múltiplas avaliações" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {multiEntry.map(([name, entries]) => {
                          const sorted = [...entries].reverse();
                          const weightData = sorted.map(e => ({ date: e.savedAt, value: parseFloat(e.patient?.weight) || null }));
                          const bfData = sorted.map(e => ({ date: e.savedAt, value: e.results?.bf ?? null }));
                          return (
                            <div key={name} className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm font-semibold text-gray-700 mb-3">{name}</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Peso (kg)</p>
                                  <MiniLineChart data={weightData} />
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-bold">{fmt(weightData[weightData.length - 1]?.value, 1)}</span>
                                    <DeltaBadge
                                      current={weightData[weightData.length - 1]?.value}
                                      previous={weightData[weightData.length - 2]?.value}
                                      unit="kg" inverse decimals={1}
                                    />
                                  </div>
                                </div>
                                {bfData.some(d => d.value != null) && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">% Gordura</p>
                                    <MiniLineChart data={bfData} color="#f59e0b" />
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm font-bold">{fmt(bfData[bfData.length - 1]?.value, 1)}%</span>
                                      <DeltaBadge
                                        current={bfData[bfData.length - 1]?.value}
                                        previous={bfData[bfData.length - 2]?.value}
                                        unit="%" inverse decimals={1}
                                      />
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

                {/* History list */}
                <div className="space-y-3">
                  {history.map((entry, idx) => {
                    const prev = history[idx + 1];
                    const samePatient = prev && prev.patient?.name === entry.patient?.name;
                    return (
                      <div key={entry.id} className="card hover:border-teal-100 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">{entry.patient?.name || 'Sem nome'}</span>
                              <span className="text-xs text-gray-400">{entry.patient?.sex === 'M' ? 'Masculino' : 'Feminino'} · {entry.patient?.age} anos</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">{formatDate(entry.savedAt)}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs text-gray-400">Peso</p>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">{entry.patient?.weight} kg</span>
                                  {samePatient && (
                                    <DeltaBadge
                                      current={parseFloat(entry.patient?.weight)}
                                      previous={parseFloat(prev.patient?.weight)}
                                      unit="kg" inverse decimals={1}
                                    />
                                  )}
                                </div>
                              </div>
                              {entry.results?.imc && (
                                <div>
                                  <p className="text-xs text-gray-400">IMC</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{fmt(entry.results.imc, 1)}</span>
                                    {samePatient && entry.results?.imc && prev.results?.imc && (
                                      <DeltaBadge
                                        current={entry.results.imc}
                                        previous={prev.results.imc}
                                        inverse decimals={1}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                              {entry.results?.bf != null && (
                                <div>
                                  <p className="text-xs text-gray-400">% Gordura</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{fmt(entry.results.bf, 1)}%</span>
                                    {samePatient && entry.results?.bf != null && prev.results?.bf != null && (
                                      <DeltaBadge
                                        current={entry.results.bf}
                                        previous={prev.results.bf}
                                        unit="%" inverse decimals={1}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                              {entry.results?.tmb && (
                                <div>
                                  <p className="text-xs text-gray-400">TMB</p>
                                  <span className="font-semibold">{fmt(entry.results.tmb, 0)} kcal</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => loadFromHistory(entry)}
                              className="text-xs text-teal-600 hover:text-teal-700 font-medium bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Carregar
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
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
        <p className="text-xs text-gray-400">
          NutriAssess — Avaliação Física Profissional | Powered by CaffaroAI
        </p>
        <p className="text-xs text-gray-300 mt-1">
          Fórmulas: Jackson &amp; Pollock (1978) · Harris-Benedict (1984) · Siri (1956) · OMS
        </p>
      </footer>
    </div>
  );
}
