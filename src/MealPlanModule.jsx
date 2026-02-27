import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp,
  ShoppingCart, Printer, Share2, RefreshCw, CheckCircle2, Info,
  Droplets, Calendar, Coffee, Sun, Sunset, Moon, Apple, Wheat,
  ChevronLeft, ChevronRight, Copy, Check
} from 'lucide-react';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─────────────────────────────────────────────────────────────────
// MACRO PRESETS
// ─────────────────────────────────────────────────────────────────
const MACRO_PRESETS = {
  'Emagrecimento':  { carb: 45, protein: 30, fat: 25 },
  'Ganho de Massa': { carb: 50, protein: 30, fat: 20 },
  'Manutenção':     { carb: 50, protein: 20, fat: 30 },
  'Low Carb':       { carb: 20, protein: 40, fat: 40 },
  'Cetogênica':     { carb: 5,  protein: 30, fat: 65 },
  'Personalizado':  { carb: 50, protein: 25, fat: 25 },
};

const DIETARY_RESTRICTIONS = [
  'Vegetariano', 'Vegano', 'Sem Glúten', 'Sem Lactose', 'Low FODMAP', 'Sem Açúcar'
];

const DURATIONS = ['1 dia', '1 semana', '2 semanas', '1 mês'];

const MEAL_ICONS = {
  'Café da Manhã': '☀️',
  'Lanche da Manhã': '🍎',
  'Almoço': '🍽️',
  'Lanche da Tarde': '🥤',
  'Jantar': '🌙',
  'Ceia': '🌟',
};

const MEAL_EMOJI = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes('café') || lower.includes('manhã')) return '☀️';
  if (lower.includes('almoço')) return '🍽️';
  if (lower.includes('jantar')) return '🌙';
  if (lower.includes('ceia')) return '🌟';
  if (lower.includes('lanche')) return '🍎';
  return '🥗';
};

const SHOPPING_CATEGORIES = [
  'Frutas e Verduras', 'Carnes e Proteínas', 'Laticínios', 'Grãos e Cereais',
  'Padaria', 'Óleos e Gorduras', 'Temperos e Condimentos', 'Bebidas', 'Outros'
];

const CATEGORY_EMOJI = {
  'Frutas e Verduras': '🥦',
  'Carnes e Proteínas': '🥩',
  'Laticínios': '🧀',
  'Grãos e Cereais': '🌾',
  'Padaria': '🍞',
  'Óleos e Gorduras': '🫒',
  'Temperos e Condimentos': '🧂',
  'Bebidas': '💧',
  'Outros': '🛒',
};

// ─────────────────────────────────────────────────────────────────
// GEMINI API CALL
// ─────────────────────────────────────────────────────────────────
async function generateMealPlanWithGemini({ patientData, config }) {
  const {
    name, age, sex, weight, height, bmi, bmiClass,
    bodyFat, tmb, get: GET, activityLevel, goal
  } = patientData;

  const { targetCalories, carbPct, protPct, fatPct, mealsPerDay,
    restrictions, allergies, avoidFoods, preferredFoods, duration } = config;

  const numDays = duration === '1 dia' ? 1
    : duration === '1 semana' ? 7
    : duration === '2 semanas' ? 14
    : 30;

  const prompt = `Você é um nutricionista especialista brasileiro. Crie um plano alimentar personalizado detalhado.

DADOS DO PACIENTE:
- Nome: ${name || 'Paciente'}
- Idade: ${age || 'N/A'} anos | Sexo: ${sex === 'M' ? 'Masculino' : 'Feminino'}
- Peso: ${weight || 'N/A'}kg | Altura: ${height || 'N/A'}cm
- IMC: ${bmi || 'N/A'} (${bmiClass || 'N/A'})
- % Gordura: ${bodyFat || 'N/A'}%
- TMB: ${tmb || 'N/A'} kcal | GET: ${GET || 'N/A'} kcal
- Nível de atividade: ${activityLevel || 'Moderado'}
- Objetivo: ${goal || 'Melhora da saúde geral'}

CONFIGURAÇÃO DO PLANO:
- Calorias alvo: ${targetCalories} kcal/dia
- Distribuição de macros: ${carbPct}% carb, ${protPct}% prot, ${fatPct}% gord
- Número de refeições: ${mealsPerDay}
- Restrições: ${restrictions.length ? restrictions.join(', ') : 'Nenhuma'}
- Alergias: ${allergies || 'Nenhuma'}
- Alimentos a evitar: ${avoidFoods || 'Nenhum'}
- Alimentos preferidos: ${preferredFoods || 'Sem preferências específicas'}
- Duração: ${duration}

Use PREFERENCIALMENTE alimentos da Tabela TACO (alimentos brasileiros comuns).
Inclua porções em gramas e medidas caseiras.
Gere ${numDays} dia(s) de plano alimentar com ${mealsPerDay} refeições por dia.
Varie os alimentos entre os dias para não repetir as mesmas refeições.

RETORNE APENAS JSON válido, sem markdown, sem texto extra:
{
  "dailyPlan": [
    {
      "day": "Segunda-feira",
      "meals": [
        {
          "name": "Café da Manhã",
          "time": "7:00",
          "items": [
            {
              "food": "Pão integral",
              "portion": "2 fatias (60g)",
              "calories": 140,
              "carbs": 26,
              "protein": 5,
              "fat": 2,
              "substitutes": ["Tapioca (2 unidades)", "Aveia (40g)"]
            }
          ],
          "totalCalories": 450,
          "totalCarbs": 55,
          "totalProtein": 25,
          "totalFat": 15
        }
      ],
      "dayTotals": { "calories": 2000, "carbs": 250, "protein": 150, "fat": 67 }
    }
  ],
  "shoppingList": [
    { "item": "Pão integral", "quantity": "1 pacote", "category": "Padaria" }
  ],
  "observations": "Observações gerais sobre o plano...",
  "hydration": "Consumir pelo menos 2.5L de água por dia"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────
// MACRO BAR
// ─────────────────────────────────────────────────────────────────
function MacroBar({ carbs, protein, fat, calories, targetCalories }) {
  const total = (carbs * 4) + (protein * 4) + (fat * 9);
  const carbPct = total > 0 ? Math.round((carbs * 4 / total) * 100) : 0;
  const protPct = total > 0 ? Math.round((protein * 4 / total) * 100) : 0;
  const fatPct = total > 0 ? Math.round((fat * 9 / total) * 100) : 0;

  const diff = targetCalories ? Math.abs(calories - targetCalories) / targetCalories * 100 : null;
  const calColor = diff === null ? 'text-gray-700'
    : diff <= 5 ? 'text-emerald-600'
    : diff <= 15 ? 'text-amber-500'
    : 'text-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-xl font-black ${calColor}`}>
          {Math.round(calories)} <span className="text-sm font-normal text-gray-400">kcal</span>
        </span>
        {diff !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            diff <= 5 ? 'bg-emerald-100 text-emerald-700' :
            diff <= 15 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {diff <= 5 ? '✓ Meta atingida' : calories > targetCalories ? `+${Math.round(diff)}%` : `-${Math.round(diff)}%`}
          </span>
        )}
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        <div className="bg-blue-400 transition-all" style={{ width: `${carbPct}%` }} title={`Carboidratos: ${carbPct}%`} />
        <div className="bg-red-400 transition-all" style={{ width: `${protPct}%` }} title={`Proteínas: ${protPct}%`} />
        <div className="bg-yellow-400 transition-all" style={{ width: `${fatPct}%` }} title={`Gorduras: ${fatPct}%`} />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Carb {carbs}g ({carbPct}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Prot {protein}g ({protPct}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Gord {fat}g ({fatPct}%)</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MEAL CARD
// ─────────────────────────────────────────────────────────────────
function MealCard({ meal }) {
  const [expanded, setExpanded] = useState(false);
  const [showSubs, setShowSubs] = useState(false);
  const emoji = MEAL_EMOJI(meal.name);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{meal.name}</p>
            <p className="text-xs text-gray-400">🕐 {meal.time}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-700">{Math.round(meal.totalCalories)} kcal</p>
            <p className="text-xs text-gray-400">C{meal.totalCarbs}g · P{meal.totalProtein}g · G{meal.totalFat}g</p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-50">
          <div className="p-4 space-y-2">
            {meal.items?.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">🍴 {item.food}</p>
                  <p className="text-xs text-gray-400">{item.portion}</p>
                  {item.substitutes?.length > 0 && showSubs && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.substitutes.map((sub, si) => (
                        <span key={si} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-100">
                          ↔ {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="text-sm font-bold text-amber-600">{item.calories} kcal</p>
                  <p className="text-xs text-gray-400">C{item.carbs}g P{item.protein}g G{item.fat}g</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-totals + show subs toggle */}
          <div className="px-4 pb-4">
            <div className="flex gap-1.5 mt-1">
              {meal.items?.some(i => i.substitutes?.length) && (
                <button
                  onClick={() => setShowSubs(s => !s)}
                  className="text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-violet-100 transition-colors"
                >
                  <RefreshCw size={11} /> {showSubs ? 'Ocultar' : 'Ver'} substituições
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DAY PLAN VIEW
// ─────────────────────────────────────────────────────────────────
function DayPlanView({ day, targetCalories }) {
  return (
    <div className="space-y-3">
      {/* Daily summary */}
      <div className="bg-gradient-to-r from-violet-50 to-violet-50/50 rounded-xl p-4 border border-violet-100">
        <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-3">Resumo do Dia</p>
        <MacroBar
          carbs={day.dayTotals?.carbs ?? 0}
          protein={day.dayTotals?.protein ?? 0}
          fat={day.dayTotals?.fat ?? 0}
          calories={day.dayTotals?.calories ?? 0}
          targetCalories={targetCalories}
        />
      </div>

      {/* Meals */}
      <div className="space-y-2">
        {day.meals?.map((meal, i) => (
          <MealCard key={i} meal={meal} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHOPPING LIST
// ─────────────────────────────────────────────────────────────────
function ShoppingListView({ items }) {
  const [copied, setCopied] = useState(false);

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const copyText = () => {
    const lines = ['🛒 LISTA DE COMPRAS', ''];
    Object.entries(grouped).forEach(([cat, catItems]) => {
      lines.push(`${CATEGORY_EMOJI[cat] || '📦'} ${cat}`);
      catItems.forEach(i => lines.push(`  • ${i.item} — ${i.quantity}`));
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ShoppingCart size={16} className="text-violet-600" /> Lista de Compras
        </h3>
        <button
          onClick={copyText}
          className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg border border-violet-100 transition-colors"
        >
          {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar lista</>}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
              <span>{CATEGORY_EMOJI[cat] || '📦'}</span> {cat}
            </p>
            <ul className="space-y-1">
              {catItems.map((item, i) => (
                <li key={i} className="flex items-start justify-between text-sm">
                  <span className="text-gray-700">{item.item}</span>
                  <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function MealPlanModule({ patient, anamnese, energyData }) {
  // Config state
  const [targetCalories, setTargetCalories] = useState('');
  const [macroPreset, setMacroPreset] = useState('Emagrecimento');
  const [customMacros, setCustomMacros] = useState({ carb: 50, protein: 25, fat: 25 });
  const [mealsPerDay, setMealsPerDay] = useState('5');
  const [restrictions, setRestrictions] = useState([]);
  const [allergies, setAllergies] = useState('');
  const [avoidFoods, setAvoidFoods] = useState('');
  const [preferredFoods, setPreferredFoods] = useState('');
  const [duration, setDuration] = useState('1 semana');

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mealPlan, setMealPlan] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'shopping'

  // Auto-fill from patient data
  useEffect(() => {
    if (energyData?.get && !targetCalories) {
      setTargetCalories(Math.round(energyData.get).toString());
    }
    if (anamnese?.alergias && !allergies) {
      setAllergies(anamnese.alergias);
    }
    if (anamnese?.objetivo) {
      const obj = anamnese.objetivo.toLowerCase();
      if (obj.includes('emagrec') || obj.includes('perda') || obj.includes('peso')) setMacroPreset('Emagrecimento');
      else if (obj.includes('massa') || obj.includes('músculo')) setMacroPreset('Ganho de Massa');
      else if (obj.includes('manutençao') || obj.includes('manutenção')) setMacroPreset('Manutenção');
    }
  }, [energyData, anamnese]);

  const currentMacros = macroPreset === 'Personalizado' ? customMacros : MACRO_PRESETS[macroPreset];

  const toggleRestriction = (r) => {
    setRestrictions(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]);
  };

  const handleGenerate = async () => {
    if (!targetCalories || parseFloat(targetCalories) < 500) {
      setError('Informe as calorias alvo (mínimo 500 kcal/dia).');
      return;
    }
    if (currentMacros.carb + currentMacros.protein + currentMacros.fat !== 100) {
      setError('A soma dos macronutrientes deve ser 100%.');
      return;
    }

    setLoading(true);
    setError(null);
    setMealPlan(null);

    try {
      const { tmb, get: GET } = energyData || {};
      const imc = patient.height && patient.weight
        ? (parseFloat(patient.weight) / Math.pow(parseFloat(patient.height) / 100, 2)).toFixed(1)
        : null;

      const imcClassLabel = imc
        ? imc < 18.5 ? 'Abaixo do peso'
          : imc < 25 ? 'Peso normal'
          : imc < 30 ? 'Sobrepeso'
          : 'Obesidade'
        : null;

      const activityMap = {
        '1.2': 'Sedentário', '1.375': 'Levemente ativo', '1.55': 'Moderadamente ativo',
        '1.725': 'Muito ativo', '1.9': 'Extremamente ativo'
      };

      const result = await generateMealPlanWithGemini({
        patientData: {
          name: patient.name,
          age: patient.age,
          sex: patient.sex,
          weight: patient.weight,
          height: patient.height,
          bmi: imc,
          bmiClass: imcClassLabel,
          bodyFat: null,
          tmb: tmb ? Math.round(tmb) : null,
          get: GET ? Math.round(GET) : null,
          activityLevel: activityMap[patient.activityFactor] || 'Moderado',
          goal: anamnese?.objetivo || 'Melhora da saúde geral',
        },
        config: {
          targetCalories: parseFloat(targetCalories),
          carbPct: currentMacros.carb,
          protPct: currentMacros.protein,
          fatPct: currentMacros.fat,
          mealsPerDay: parseInt(mealsPerDay),
          restrictions,
          allergies,
          avoidFoods,
          preferredFoods,
          duration,
        },
      });

      setMealPlan(result);
      setActiveDay(0);
      setActiveTab('plan');
    } catch (err) {
      console.error(err);
      setError(`Erro ao gerar plano: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const DAY_ABBR = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="space-y-4">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-white shadow-lg shadow-violet-200">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-violet-200" />
            <span className="text-violet-200 text-sm font-semibold uppercase tracking-wider">Powered by IA</span>
          </div>
          <h2 className="text-2xl font-black mb-1">Plano Alimentar</h2>
          <p className="text-violet-100 text-sm max-w-md">
            Configure o plano e a IA gera refeições personalizadas com base nos dados do paciente, tabela TACO e preferências.
          </p>
        </div>
        <div className="absolute right-4 top-4 opacity-10">
          <UtensilsCrossed size={100} />
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
            <UtensilsCrossed size={14} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Configuração do Plano</h3>
            <p className="text-xs text-gray-400">Personalize as preferências nutricionais</p>
          </div>
        </div>

        {/* Row 1: Calories + Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Calorias alvo / dia</label>
            <div className="relative">
              <input
                type="number"
                value={targetCalories}
                onChange={e => setTargetCalories(e.target.value)}
                placeholder={energyData?.get ? `GET: ${Math.round(energyData.get)} kcal` : 'ex: 2000'}
                className="input-field pr-14"
                min="500" max="6000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
            </div>
            {energyData?.get && (
              <p className="text-xs text-violet-500 mt-1 flex items-center gap-1">
                <Info size={11} /> GET calculado: {Math.round(energyData.get)} kcal
              </p>
            )}
          </div>

          <div>
            <label className="label">Duração do plano</label>
            <select className="input-field" value={duration} onChange={e => setDuration(e.target.value)}>
              {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Macro preset */}
        <div>
          <label className="label">Distribuição de Macros</label>
          <select className="input-field" value={macroPreset} onChange={e => setMacroPreset(e.target.value)}>
            {Object.keys(MACRO_PRESETS).map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Macro visual */}
          <div className="mt-3 p-3 bg-gray-50 rounded-xl">
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2">
              <div className="bg-blue-400 transition-all" style={{ width: `${currentMacros.carb}%` }} />
              <div className="bg-red-400 transition-all" style={{ width: `${currentMacros.protein}%` }} />
              <div className="bg-yellow-400 transition-all" style={{ width: `${currentMacros.fat}%` }} />
            </div>
            <div className="flex gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Carb {currentMacros.carb}%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Prot {currentMacros.protein}%</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Gord {currentMacros.fat}%</span>
              {targetCalories && (
                <span className="ml-auto text-gray-400">
                  ≈ C{Math.round(parseFloat(targetCalories) * currentMacros.carb / 100 / 4)}g
                  · P{Math.round(parseFloat(targetCalories) * currentMacros.protein / 100 / 4)}g
                  · G{Math.round(parseFloat(targetCalories) * currentMacros.fat / 100 / 9)}g
                </span>
              )}
            </div>
          </div>

          {/* Custom macro inputs */}
          {macroPreset === 'Personalizado' && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { key: 'carb', label: 'Carboidratos %', color: 'blue' },
                { key: 'protein', label: 'Proteínas %', color: 'red' },
                { key: 'fat', label: 'Gorduras %', color: 'yellow' },
              ].map(({ key, label, color }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
                  <input
                    type="number" min="0" max="100"
                    value={customMacros[key]}
                    onChange={e => setCustomMacros(m => ({ ...m, [key]: parseInt(e.target.value) || 0 }))}
                    className="input-field"
                  />
                </div>
              ))}
              {customMacros.carb + customMacros.protein + customMacros.fat !== 100 && (
                <p className="col-span-3 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> Total: {customMacros.carb + customMacros.protein + customMacros.fat}% (deve ser 100%)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Row 3: Meals per day */}
        <div>
          <label className="label">Número de refeições / dia</label>
          <div className="flex gap-2">
            {['3', '4', '5', '6'].map(n => (
              <button
                key={n}
                onClick={() => setMealsPerDay(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  mealsPerDay === n
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>

        {/* Row 4: Dietary restrictions */}
        <div>
          <label className="label">Restrições alimentares</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DIETARY_RESTRICTIONS.map(r => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer group p-2 rounded-lg hover:bg-violet-50 transition-colors">
                <input
                  type="checkbox"
                  checked={restrictions.includes(r)}
                  onChange={() => toggleRestriction(r)}
                  className="accent-violet-600 w-4 h-4 rounded"
                />
                <span className="text-gray-700 group-hover:text-violet-700">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Row 5: Text fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Alergias alimentares</label>
            <input
              type="text"
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder="ex: amendoim, frutos do mar"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Alimentos a evitar</label>
            <input
              type="text"
              value={avoidFoods}
              onChange={e => setAvoidFoods(e.target.value)}
              placeholder="ex: brócolis, fígado"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Alimentos preferidos</label>
            <input
              type="text"
              value={preferredFoods}
              onChange={e => setPreferredFoods(e.target.value)}
              placeholder="ex: frango, batata doce"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !targetCalories}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all ${
          loading || !targetCalories
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:scale-[1.01]'
        }`}
      >
        {loading ? (
          <><Loader2 size={20} className="animate-spin" /> Gerando plano alimentar personalizado...</>
        ) : (
          <><Sparkles size={20} /> Gerar Plano Alimentar com IA</>
        )}
      </button>

      {/* Loading card */}
      {loading && (
        <div className="bg-white rounded-2xl border border-violet-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 size={20} className="animate-spin text-violet-600" />
            <div>
              <p className="font-semibold text-gray-800">Criando seu plano alimentar personalizado...</p>
              <p className="text-xs text-gray-400">A IA está selecionando alimentos da tabela TACO. Pode demorar alguns segundos.</p>
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                  <div className="h-2 bg-gray-100 rounded animate-pulse w-2/3" />
                  <div className="h-2 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Erro ao gerar plano</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* RESULT: Meal Plan */}
      {mealPlan && !loading && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800">Plano Alimentar Gerado ✅</h3>
                <p className="text-xs text-gray-400">
                  {mealPlan.dailyPlan?.length} dia(s) · {mealsPerDay} refeições/dia · {targetCalories} kcal/dia
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg border border-violet-100 transition-colors"
                >
                  <RefreshCw size={12} /> Regenerar
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                >
                  <Printer size={12} /> Imprimir
                </button>
              </div>
            </div>

            {/* Overall macro bar (average of all days) */}
            {mealPlan.dailyPlan?.length > 0 && (() => {
              const avg = mealPlan.dailyPlan.reduce((acc, day) => ({
                calories: acc.calories + (day.dayTotals?.calories || 0),
                carbs: acc.carbs + (day.dayTotals?.carbs || 0),
                protein: acc.protein + (day.dayTotals?.protein || 0),
                fat: acc.fat + (day.dayTotals?.fat || 0),
              }), { calories: 0, carbs: 0, protein: 0, fat: 0 });
              const n = mealPlan.dailyPlan.length;
              return (
                <MacroBar
                  calories={avg.calories / n}
                  carbs={avg.carbs / n}
                  protein={avg.protein / n}
                  fat={avg.fat / n}
                  targetCalories={parseFloat(targetCalories)}
                />
              );
            })()}

            {/* Hydration */}
            {mealPlan.hydration && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Droplets size={16} className="text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-700">{mealPlan.hydration}</p>
              </div>
            )}
          </div>

          {/* Tabs: Plano / Lista de Compras */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === 'plan'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-200'
              }`}
            >
              <UtensilsCrossed size={14} /> Plano Alimentar
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === 'shopping'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-200'
              }`}
            >
              <ShoppingCart size={14} /> Lista de Compras
              {mealPlan.shoppingList?.length > 0 && (
                <span className="bg-violet-100 text-violet-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {mealPlan.shoppingList.length}
                </span>
              )}
            </button>
          </div>

          {/* Plan tab */}
          {activeTab === 'plan' && (
            <div>
              {/* Day tabs (only if multi-day) */}
              {mealPlan.dailyPlan?.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
                  {mealPlan.dailyPlan.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveDay(i)}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        activeDay === i
                          ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-violet-200 hover:text-violet-600'
                      }`}
                    >
                      {/* Show day abbreviation */}
                      {DAY_ABBR[i % 7]}
                      <span className="block text-xs opacity-70">{i + 1}º dia</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active day plan */}
              {mealPlan.dailyPlan?.[activeDay] && (
                <DayPlanView
                  day={mealPlan.dailyPlan[activeDay]}
                  targetCalories={parseFloat(targetCalories)}
                />
              )}

              {/* Day navigation (multi-day) */}
              {mealPlan.dailyPlan?.length > 1 && (
                <div className="flex justify-between mt-3">
                  <button
                    onClick={() => setActiveDay(d => Math.max(0, d - 1))}
                    disabled={activeDay === 0}
                    className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    <ChevronLeft size={14} /> Dia anterior
                  </button>
                  <button
                    onClick={() => setActiveDay(d => Math.min(mealPlan.dailyPlan.length - 1, d + 1))}
                    disabled={activeDay === mealPlan.dailyPlan.length - 1}
                    className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-30 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    Próximo dia <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Shopping tab */}
          {activeTab === 'shopping' && mealPlan.shoppingList?.length > 0 && (
            <ShoppingListView items={mealPlan.shoppingList} />
          )}

          {/* Observations */}
          {mealPlan.observations && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-amber-600" />
                <p className="text-sm font-semibold text-amber-700">Observações do Nutricionista IA</p>
              </div>
              <p className="text-sm text-amber-800 leading-relaxed">{mealPlan.observations}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <Sparkles size={10} /> Plano gerado por IA com base em dados clínicos — revisar antes de prescrever
          </p>
        </div>
      )}
    </div>
  );
}
