const STORAGE_KEY = 'nutri-assess-history';

export function loadHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAssessment(assessment) {
  const history = loadHistory();
  const entry = {
    ...assessment,
    id: Date.now(),
    savedAt: new Date().toISOString(),
  };
  history.unshift(entry);
  // Keep last 50
  const trimmed = history.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return entry;
}

export function deleteAssessment(id) {
  const history = loadHistory();
  const updated = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
