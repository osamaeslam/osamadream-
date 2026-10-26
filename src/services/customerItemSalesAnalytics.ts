import { Customer, CustomerItemSaleRecord, User } from '../types';
import {
  isArabicNameMatch,
  isBranchMatch,
  normalizeArabicText,
  resolveBranchName
} from './arabicMatchingService';
import { MONTH_NAMES_MAP } from './customerItemSalesService';

/* ============================================================
   Item-level sales analytics
   ------------------------------------------------------------
   Read-only helpers: they never rewrite an amount, discount,
   quantity or tax value. They only group rows that already
   exist in the imported sheet.
   ============================================================ */

export type PeriodPreset =
  | 'all'
  | 'latest_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'month'
  | 'custom';

export interface SalesPeriod {
  mode: 'all' | 'month' | 'range';
  months?: number[];
  year?: number;
  from?: string;
  to?: string;
  label: string;
}

export interface SalesFilterState {
  search: string;
  periodPreset: PeriodPreset;
  month: number | 'all';
  customFrom: string;
  customTo: string;
  branch: string;
  repName: string;
  supervisorName: string;
  itemGroup: string;
}

export interface EnrichedSaleRecord extends CustomerItemSaleRecord {
  _date: Date | null;
  _dateISO: string | null;
  _year: number | null;
  _branch: string;
  _supervisorName: string;
  _customerKey: string;
  _itemKey: string;
  _isPlaceholderCustomer: boolean;
  _isPlaceholderItem: boolean;
  _searchText: string;
}

export interface RepDirectory {
  users: User[];
  byId: Map<string, User>;
  byName: Map<string, User[]>;
}

export interface FilterOptions {
  branches: string[];
  reps: string[];
  supervisors: string[];
  groups: string[];
  years: number[];
  hasDates: boolean;
  minDate: Date | null;
  maxDate: Date | null;
}

export interface SalesDataQuality {
  totalRows: number;
  datedRows: number;
  undatedRows: number;
  dateCoveragePercent: number;
  hasCompleteDates: boolean;
  missingCustomerCode: number;
  placeholderCustomerCode: number;
  missingItemCode: number;
  placeholderItemCode: number;
  missingSalesOrder: number;
  missingRep: number;
  unmappedReps: string[];
  rowsWithoutSupervisor: number;
  years: number[];
}

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] || d);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseSaleDate(raw?: string): Date | null {
  if (!raw) return null;
  const text = toLatinDigits(String(raw)).trim();
  if (!text) return null;

  // Excel serial date (e.g. 45444), not a quantity or a price.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 80000) {
      const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
      const date = new Date(ms);
      return isValidDate(date) ? date : null;
    }
  }

  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isValidDate(date) ? date : null;
  }

  const dmy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmy) {
    let day = Number(dmy[1]);
    let month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (day > 12 || month <= 12) {
      // keep day-first
    } else if (month > 12 && day <= 12) {
      const swap = day;
      day = month;
      month = swap;
    }
    const date = new Date(year, month - 1, day);
    return isValidDate(date) ? date : null;
  }

  const fallback = new Date(text);
  return isValidDate(fallback) ? fallback : null;
}

function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

export function formatDateDisplay(value: string | Date | null | undefined): string {
  if (!value) return 'غير متوفر';
  const date = value instanceof Date ? value : parseSaleDate(String(value));
  if (!date) return 'غير متوفر';
  try {
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return toISODate(date);
  }
}

export function formatMonthLabel(month?: number): string {
  if (!month || month < 1 || month > 12) return '';
  return MONTH_NAMES_MAP[month] || `شهر ${month}`;
}

export function isPlaceholderCode(value?: string): boolean {
  const code = String(value || '').trim().toLowerCase();
  if (!code) return true;
  if (/^(item|cust|customer)-\d+$/i.test(code)) return true;
  return [
    '---', '--', '-', '#---', '#--', '#-', '#0', '0',
    'بدون', 'لا يوجد', 'غير محدد', 'none', 'null', 'undefined', 'nan'
  ].includes(code);
}

export function buildRepDirectory(users: User[]): RepDirectory {
  const byId = new Map<string, User>();
  const byName = new Map<string, User[]>();
  (users || []).forEach((user) => {
    if (!user) return;
    if (user.id) byId.set(String(user.id), user);
    if (user.username) byId.set(String(user.username).toLowerCase(), user);
    const nameKey = normalizeArabicText(user.name);
    if (!nameKey) return;
    const existing = byName.get(nameKey) || [];
    existing.push(user);
    byName.set(nameKey, existing);
  });
  return { users: users || [], byId, byName };
}

export function findRepUser(
  record: Pick<CustomerItemSaleRecord, 'repId' | 'repName'>,
  directory: RepDirectory
): User | undefined {
  const rawId = String(record.repId || '').trim();
  if (rawId) {
    const byId = directory.byId.get(rawId) || directory.byId.get(rawId.toLowerCase());
    if (byId) return byId;
  }

  const nameKey = normalizeArabicText(record.repName);
  if (!nameKey) return undefined;
  const exact = directory.byName.get(nameKey) || [];
  if (exact.length > 0) {
    return exact.find((user) => user.role === 'sales_rep') || exact[0];
  }

  return directory.users.find(
    (user) =>
      user.role === 'sales_rep' &&
      user.name &&
      isArabicNameMatch(user.name, record.repName)
  );
}

export function resolveSupervisorName(
  record: Pick<CustomerItemSaleRecord, 'repId' | 'repName'>,
  directory: RepDirectory
): string {
  const rep = findRepUser(record, directory);
  if (rep?.supervisorId) {
    const supervisor = directory.byId.get(String(rep.supervisorId));
    if (supervisor?.name) return supervisor.name;
  }
  return 'غير محدد';
}

export function enrichSalesRecords(
  records: CustomerItemSaleRecord[],
  users: User[]
): EnrichedSaleRecord[] {
  const directory = buildRepDirectory(users);

  return (records || []).map((record) => {
    const date = parseSaleDate(record.date);
    const branchRaw = String(record.warehouse || '').trim();
    const branch = resolveBranchName(branchRaw) || branchRaw || 'غير محدد';
    const supervisor = resolveSupervisorName(record, directory);
    const placeholderCustomer = isPlaceholderCode(record.customerAccount);
    const placeholderItem = isPlaceholderCode(record.itemCode);
    const customerKey = placeholderCustomer
      ? `name:${normalizeArabicText(record.invoicingName)}`
      : `account:${String(record.customerAccount || '').trim().toLowerCase()}`;
    const itemKey = placeholderItem
      ? `name:${normalizeArabicText(record.itemName)}`
      : `code:${String(record.itemCode || '').trim().toLowerCase()}`;

    const searchText = normalizeArabicText(
      [
        record.customerAccount,
        record.invoicingName,
        record.itemCode,
        record.itemName,
        record.salesOrder,
        record.repName,
        record.warehouse,
        record.itemGroup,
        record.familyDimension,
        supervisor
      ].filter(Boolean).join(' ')
    );

    return {
      ...record,
      _date: date,
      _dateISO: date ? toISODate(date) : null,
      _year: date ? date.getFullYear() : null,
      _branch: branch,
      _supervisorName: supervisor,
      _customerKey: customerKey || `name:${normalizeArabicText(record.invoicingName)}`,
      _itemKey: itemKey || `name:${normalizeArabicText(record.itemName)}`,
      _isPlaceholderCustomer: placeholderCustomer,
      _isPlaceholderItem: placeholderItem,
      _searchText: searchText
    };
  });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthLabel(month: number, year?: number): string {
  return `${formatMonthLabel(month)}${year ? ` ${year}` : ''}`;
}

export function getDateBounds(records: EnrichedSaleRecord[]): {
  minDate: Date | null;
  maxDate: Date | null;
} {
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  records.forEach((record) => {
    if (!record._date) return;
    if (!minDate || record._date < minDate) minDate = record._date;
    if (!maxDate || record._date > maxDate) maxDate = record._date;
  });
  return { minDate, maxDate };
}

export function buildPeriod(
  state: SalesFilterState,
  records: EnrichedSaleRecord[]
): SalesPeriod {
  const { maxDate } = getDateBounds(records);

  if (state.periodPreset === 'all') {
    return { mode: 'all', label: 'كل الفترة' };
  }

  if (state.periodPreset === 'month') {
    if (state.month === 'all') return { mode: 'all', label: 'كل الشهور' };
    const month = state.month;
    const year = maxDate ? maxDate.getFullYear() : undefined;
    return {
      mode: 'month',
      months: [month],
      year,
      label: monthLabel(month, year)
    };
  }

  if (!maxDate) {
    return { mode: 'all', label: 'كل الفترة' };
  }

  if (state.periodPreset === 'custom') {
    const from = parseSaleDate(state.customFrom);
    const to = parseSaleDate(state.customTo);
    if (!from || !to || from > to) return { mode: 'all', label: 'كل الفترة' };
    return {
      mode: 'range',
      from: toISODate(from),
      to: toISODate(to),
      label: `${formatDateDisplay(from)} — ${formatDateDisplay(to)}`
    };
  }

  if (state.periodPreset === 'latest_month') {
    const from = startOfMonth(maxDate);
    const to = endOfMonth(maxDate);
    return {
      mode: 'range',
      from: toISODate(from),
      to: toISODate(to),
      label: monthLabel(maxDate.getMonth() + 1, maxDate.getFullYear())
    };
  }

  if (state.periodPreset === 'last_3_months' || state.periodPreset === 'last_6_months') {
    const monthsBack = state.periodPreset === 'last_3_months' ? 2 : 5;
    const from = new Date(maxDate.getFullYear(), maxDate.getMonth() - monthsBack, 1);
    const to = endOfMonth(maxDate);
    return {
      mode: 'range',
      from: toISODate(from),
      to: toISODate(to),
      label: `${formatDateDisplay(from)} — ${formatDateDisplay(to)}`
    };
  }

  if (state.periodPreset === 'this_year') {
    const from = new Date(maxDate.getFullYear(), 0, 1);
    const to = new Date(maxDate.getFullYear(), 11, 31);
    return {
      mode: 'range',
      from: toISODate(from),
      to: toISODate(to),
      label: `سنة ${maxDate.getFullYear()}`
    };
  }

  return { mode: 'all', label: 'كل الفترة' };
}

export function buildPreviousPeriod(period: SalesPeriod): SalesPeriod | null {
  if (period.mode === 'all') return null;

  if (period.mode === 'month') {
    const month = period.months?.[0];
    if (!month || period.months?.length !== 1 || !period.year) return null;
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? period.year - 1 : period.year;
    return {
      mode: 'month',
      months: [previousMonth],
      year: previousYear,
      label: monthLabel(previousMonth, previousYear)
    };
  }

  if (!period.from || !period.to) return null;
  const from = parseSaleDate(period.from);
  const to = parseSaleDate(period.to);
  if (!from || !to || from > to) return null;
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days <= 0) return null;
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(days - 1));
  return {
    mode: 'range',
    from: toISODate(previousFrom),
    to: toISODate(previousTo),
    label: `${formatDateDisplay(previousFrom)} — ${formatDateDisplay(previousTo)}`
  };
}

export function recordMatchesPeriod(record: EnrichedSaleRecord, period: SalesPeriod): boolean {
  if (period.mode === 'all') return true;

  if (period.mode === 'month') {
    if (!period.months || period.months.length === 0) return true;
    if (!period.months.includes(record.month)) return false;
    // Undated rows still have a month bucket; never hide them just because a
    // year could not be inferred. The quality banner tells the user about it.
    if (period.year && record._year !== null) return record._year === period.year;
    return true;
  }

  if (!record._date) return false;
  const from = period.from ? parseSaleDate(period.from) : null;
  const to = period.to ? parseSaleDate(period.to) : null;
  if (from && record._date < from) return false;
  if (to) {
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
    if (record._date > end) return false;
  }
  return true;
}

export function filterSalesRecords(
  records: EnrichedSaleRecord[],
  filter: SalesFilterState,
  period: SalesPeriod
): EnrichedSaleRecord[] {
  const search = normalizeArabicText(filter.search);
  return records.filter((record) => {
    if (search && !record._searchText.includes(search)) return false;
    if (!recordMatchesPeriod(record, period)) return false;

    if (filter.branch && filter.branch !== 'ALL') {
      if (!record._branch || record._branch === 'غير محدد') return false;
      if (!isBranchMatch(record._branch, filter.branch, { allowUnassigned: false })) return false;
    }

    if (filter.repName && filter.repName !== 'ALL') {
      if (
        normalizeArabicText(record.repName) !== normalizeArabicText(filter.repName) &&
        !isArabicNameMatch(record.repName, filter.repName)
      ) return false;
    }

    if (filter.supervisorName && filter.supervisorName !== 'ALL') {
      if (normalizeArabicText(record._supervisorName) !== normalizeArabicText(filter.supervisorName)) {
        return false;
      }
    }

    if (filter.itemGroup && filter.itemGroup !== 'ALL') {
      if (normalizeArabicText(record.itemGroup) !== normalizeArabicText(filter.itemGroup)) {
        return false;
      }
    }

    return true;
  });
}

export function getFilterOptions(records: EnrichedSaleRecord[]): FilterOptions {
  const branches = new Set<string>();
  const reps = new Set<string>();
  const supervisors = new Set<string>();
  const groups = new Set<string>();
  const years = new Set<number>();
  let hasUnknownBranch = false;

  records.forEach((record) => {
    if (record._branch && record._branch !== 'غير محدد') branches.add(record._branch);
    else hasUnknownBranch = true;
    if (record.repName) reps.add(record.repName);
    supervisors.add(record._supervisorName || 'غير محدد');
    if (record.itemGroup) groups.add(record.itemGroup);
    if (record._year) years.add(record._year);
  });

  if (hasUnknownBranch) branches.add('غير محدد');

  const sortArabic = (a: string, b: string) => a.localeCompare(b, 'ar');
  const { minDate, maxDate } = getDateBounds(records);

  return {
    branches: Array.from(branches).sort(sortArabic),
    reps: Array.from(reps).filter(Boolean).sort(sortArabic),
    supervisors: Array.from(supervisors).filter(Boolean).sort(sortArabic),
    groups: Array.from(groups).filter(Boolean).sort(sortArabic),
    years: Array.from(years).sort((a, b) => b - a),
    hasDates: Boolean(minDate && maxDate),
    minDate,
    maxDate
  };
}

export function buildDataQuality(
  records: EnrichedSaleRecord[],
  users: User[]
): SalesDataQuality {
  const directory = buildRepDirectory(users);
  let datedRows = 0;
  let missingCustomerCode = 0;
  let placeholderCustomerCode = 0;
  let missingItemCode = 0;
  let placeholderItemCode = 0;
  let missingSalesOrder = 0;
  let missingRep = 0;
  let rowsWithoutSupervisor = 0;
  const unmappedReps = new Set<string>();
  const years = new Set<number>();

  records.forEach((record) => {
    if (record._date) {
      datedRows += 1;
      if (record._year) years.add(record._year);
    }
    if (!String(record.customerAccount || '').trim()) missingCustomerCode += 1;
    if (record._isPlaceholderCustomer) placeholderCustomerCode += 1;
    if (!String(record.itemCode || '').trim()) missingItemCode += 1;
    if (record._isPlaceholderItem) placeholderItemCode += 1;
    if (!String(record.salesOrder || '').trim()) missingSalesOrder += 1;
    if (!record.repName || record.repName === 'غير محدد') missingRep += 1;
    if (record._supervisorName === 'غير محدد') rowsWithoutSupervisor += 1;
    if (record.repName && record.repName !== 'غير محدد' && !findRepUser(record, directory)) {
      unmappedReps.add(record.repName);
    }
  });

  const totalRows = records.length;
  return {
    totalRows,
    datedRows,
    undatedRows: totalRows - datedRows,
    dateCoveragePercent: totalRows > 0 ? (datedRows / totalRows) * 100 : 0,
    hasCompleteDates: totalRows > 0 && datedRows === totalRows,
    missingCustomerCode,
    placeholderCustomerCode,
    missingItemCode,
    placeholderItemCode,
    missingSalesOrder,
    missingRep,
    unmappedReps: Array.from(unmappedReps).sort((a, b) => a.localeCompare(b, 'ar')),
    rowsWithoutSupervisor,
    years: Array.from(years).sort((a, b) => b - a)
  };
}

export function getRecordDateLabel(record: CustomerItemSaleRecord): string {
  const date = parseSaleDate(record.date);
  if (date) return formatDateDisplay(date);
  return record.month ? `${formatMonthLabel(record.month)} (شهر فقط)` : 'غير متوفر';
}
