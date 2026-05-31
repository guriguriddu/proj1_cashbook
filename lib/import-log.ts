export interface ImportLog {
  id: string;
  importedAt: string;
  source: 'ocr' | 'file';
  count: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  merchants: string[];
  totalAmount: number;
}

const KEY = 'cashbook_import_logs';
const MAX_LOGS = 50;

export function getImportLogs(): ImportLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveImportLog(log: Omit<ImportLog, 'id' | 'importedAt'>): void {
  if (typeof window === 'undefined') return;
  const logs = getImportLogs();
  const entry: ImportLog = {
    ...log,
    id: Date.now().toString(),
    importedAt: new Date().toISOString(),
  };
  const updated = [entry, ...logs].slice(0, MAX_LOGS);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function clearImportLogs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
