// ============================================================
// NutriAssess — Cálculos de Composição Corporal
// Todas as fórmulas são cientificamente validadas
// ============================================================

/**
 * IMC (Índice de Massa Corporal)
 */
export function calcIMC(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
}

export function classifyIMC(imc) {
  if (imc === null) return null;
  if (imc < 18.5) return { label: 'Abaixo do peso', color: 'yellow', risk: 'baixo' };
  if (imc < 25.0) return { label: 'Normal', color: 'green', risk: 'normal' };
  if (imc < 30.0) return { label: 'Sobrepeso', color: 'yellow', risk: 'aumentado' };
  if (imc < 35.0) return { label: 'Obesidade Grau I', color: 'red', risk: 'alto' };
  if (imc < 40.0) return { label: 'Obesidade Grau II', color: 'red', risk: 'muito alto' };
  return { label: 'Obesidade Grau III', color: 'red', risk: 'extremo' };
}

/**
 * Relação Cintura-Quadril (RCQ / WHR)
 * Classificação OMS
 */
export function calcRCQ(waist, hip) {
  if (!waist || !hip) return null;
  return waist / hip;
}

export function classifyRCQ(rcq, sex) {
  if (rcq === null) return null;
  if (sex === 'M') {
    if (rcq < 0.90) return { label: 'Baixo risco', color: 'green' };
    if (rcq < 0.95) return { label: 'Risco moderado', color: 'yellow' };
    return { label: 'Alto risco', color: 'red' };
  } else {
    if (rcq < 0.80) return { label: 'Baixo risco', color: 'green' };
    if (rcq < 0.85) return { label: 'Risco moderado', color: 'yellow' };
    return { label: 'Alto risco', color: 'red' };
  }
}

/**
 * Percentual de Gordura Corporal
 * Jackson & Pollock 3 dobras
 * Equação de Siri
 */
export function calcBodyFatJP3(skinfolds, sex, age) {
  const { triceps, suprailiac, thigh, chest, abdominal } = skinfolds;
  if (!age) return null;

  let sum3 = 0;
  if (sex === 'M') {
    // Homens: peitoral, abdominal, coxa
    if (!chest || !abdominal || !thigh) return null;
    sum3 = parseFloat(chest) + parseFloat(abdominal) + parseFloat(thigh);
  } else {
    // Mulheres: tríceps, suprailíaca, coxa
    if (!triceps || !suprailiac || !thigh) return null;
    sum3 = parseFloat(triceps) + parseFloat(suprailiac) + parseFloat(thigh);
  }

  const a = age;
  let density;
  if (sex === 'M') {
    density = 1.10938 - 0.0008267 * sum3 + 0.0000016 * (sum3 * sum3) - 0.0002574 * a;
  } else {
    density = 1.0994921 - 0.0009929 * sum3 + 0.0000023 * (sum3 * sum3) - 0.0001392 * a;
  }

  // Equação de Siri
  const pctGordura = (495 / density) - 450;
  return { pct: pctGordura, density, sum3, protocol: '3 dobras (J&P)' };
}

export function calcBodyFatJP7(skinfolds, sex, age) {
  const { triceps, biceps, subscapular, suprailiac, abdominal, thigh, chest } = skinfolds;
  if (!age) return null;
  if (!triceps || !biceps || !subscapular || !suprailiac || !abdominal || !thigh || !chest) return null;

  const sum7 = parseFloat(triceps) + parseFloat(biceps) + parseFloat(subscapular) +
               parseFloat(suprailiac) + parseFloat(abdominal) + parseFloat(thigh) + parseFloat(chest);
  const a = age;

  let density;
  if (sex === 'M') {
    density = 1.112 - 0.00043499 * sum7 + 0.00000055 * (sum7 * sum7) - 0.00028826 * a;
  } else {
    density = 1.097 - 0.00046971 * sum7 + 0.00000056 * (sum7 * sum7) - 0.00012828 * a;
  }

  const pctGordura = (495 / density) - 450;
  return { pct: pctGordura, density, sum7, protocol: '7 dobras (J&P)' };
}

export function classifyBodyFat(pct, sex) {
  if (pct === null) return null;
  if (sex === 'M') {
    if (pct < 6) return { label: 'Essencial', color: 'yellow' };
    if (pct < 14) return { label: 'Atleta', color: 'green' };
    if (pct < 18) return { label: 'Boa forma', color: 'green' };
    if (pct < 25) return { label: 'Aceitável', color: 'yellow' };
    return { label: 'Obesidade', color: 'red' };
  } else {
    if (pct < 14) return { label: 'Essencial', color: 'yellow' };
    if (pct < 21) return { label: 'Atleta', color: 'green' };
    if (pct < 25) return { label: 'Boa forma', color: 'green' };
    if (pct < 32) return { label: 'Aceitável', color: 'yellow' };
    return { label: 'Obesidade', color: 'red' };
  }
}

/**
 * Massa Gorda e Magra
 */
export function calcBodyComposition(weight, pctFat) {
  if (!weight || pctFat === null) return null;
  const fatMass = weight * (pctFat / 100);
  const leanMass = weight - fatMass;
  return { fatMass, leanMass };
}

/**
 * TMB — Harris-Benedict (revisada 1984)
 * Homens: 66.5 + (13.75 × P) + (5.003 × A) - (6.75 × I)
 * Mulheres: 655.1 + (9.563 × P) + (1.850 × A) - (4.676 × I)
 */
export function calcTMB(weight, heightCm, age, sex) {
  if (!weight || !heightCm || !age) return null;
  if (sex === 'M') {
    return 66.5 + (13.75 * weight) + (5.003 * heightCm) - (6.75 * age);
  } else {
    return 655.1 + (9.563 * weight) + (1.850 * heightCm) - (4.676 * age);
  }
}

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: 'Sedentário (pouco ou nenhum exercício)' },
  { value: 1.375, label: 'Levemente ativo (1-3x/semana)' },
  { value: 1.55, label: 'Moderadamente ativo (3-5x/semana)' },
  { value: 1.725, label: 'Muito ativo (6-7x/semana)' },
  { value: 1.9, label: 'Extremamente ativo (2x/dia, trabalho físico)' },
];

export function calcGET(tmb, activityFactor) {
  if (!tmb || !activityFactor) return null;
  return tmb * activityFactor;
}

/**
 * Peso Ideal (baseado em IMC 18.5–24.9)
 */
export function calcPesoIdeal(heightCm) {
  if (!heightCm) return null;
  const h = heightCm / 100;
  const min = 18.5 * h * h;
  const max = 24.9 * h * h;
  return { min, max };
}

/**
 * Formata número com casas decimais
 */
export function fmt(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

/**
 * Retorna classe CSS de cor baseada no status
 */
export function colorClass(color) {
  switch (color) {
    case 'green': return 'badge-green';
    case 'yellow': return 'badge-yellow';
    case 'red': return 'badge-red';
    default: return 'badge-gray';
  }
}

export function colorText(color) {
  switch (color) {
    case 'green': return 'text-emerald-600';
    case 'yellow': return 'text-amber-500';
    case 'red': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

export function colorBg(color) {
  switch (color) {
    case 'green': return 'bg-emerald-500';
    case 'yellow': return 'bg-amber-400';
    case 'red': return 'bg-red-500';
    default: return 'bg-gray-300';
  }
}
