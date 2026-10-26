import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer, CustomerItemSaleRecord } from '../types';
import {
  aggregateCustomerItemSales,
  exportCustomerItemSalesToExcel,
  fetchCustomerItemSalesFromGoogleSheet,
  filterCustomerItemSalesByRBAC,
  getCustomerItemSalesSQLSchema,
  getSavedCustomerItemSales,
  parseExcelCustomerItemSales,
  saveCustomerItemSales
} from '../services/customerItemSalesService';
import { getSavedSourceUrl } from '../services/dataSourceService';
import { formatCurrency } from '../services/invoiceService';
import {
  SalesFilterState,
  buildDataQuality,
  buildPeriod,
  buildPreviousPeriod,
  enrichSalesRecords,
  filterSalesRecords,
  getFilterOptions
} from '../services/customerItemSalesAnalytics';
import {
  buildComparison,
  buildCustomerAggregates,
  buildItemAggregates,
  buildSalesOpportunities,
  buildTotals
} from '../services/customerItemSalesInsights';
import { ItemSalesFilters } from './customers/ItemSalesFilters';
import { ItemSalesItemsTable, ItemSortKey } from './customers/ItemSalesItemsTable';
import { ItemSalesInsights } from './customers/ItemSalesInsights';
import { ItemSalesCustomerDrawer } from './customers/ItemSalesCustomerDrawer';

interface CustomerItemSalesViewProps {
  onOpenNewOrderForCustomer?: (customer: Customer, prefilledItemCode?: string) => void;
  onNavigateToExcel?: () => void;
}

const INITIAL_FILTER: SalesFilterState = {
  search: '',
  periodPreset: 'all',
  month: 'all',
  customFrom: '',
  customTo: '',
  branch: 'ALL',
  repName: 'ALL',
  supervisorName: 'ALL',
  itemGroup: 'ALL'
};

function formatNumber(value: number | null | undefined): string {
  return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const DeltaBadge: React.FC<{ value: number | null; suffix?: string }> = ({
  value,
  suffix = '%'
}) => {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[10px] font-bold text-slate-400">—</span>;
  }
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-black ${
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`} dir="ltr">
      {positive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
};

export const CustomerItemSalesView: React.FC<CustomerItemSalesViewProps> = ({
  onOpenNewOrderForCustomer,
  onNavigateToExcel
}) => {
  const { currentUser, users, customers } = useApp();

  const [salesRecords, setSalesRecords] = useState<CustomerItemSaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  const [filter, setFilter] = useState<SalesFilterState>(INITIAL_FILTER);
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>('amount');
  const [itemSortDirection, setItemSortDirection] = useState<'asc' | 'desc'>('desc');
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(10);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize] = useState(8);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = getSavedCustomerItemSales();
    setSalesRecords(Array.isArray(saved) ? saved : []);
    setIsLoading(false);
  }, []);

  const applyRecords = (records: CustomerItemSaleRecord[], message: string) => {
    setSalesRecords(records);
    const saved = saveCustomerItemSales(records);
    if (!saved) {
      setSyncErrorMsg('تم تحميل البيانات في الشاشة، لكن تعذر حفظها على هذا الجهاز (مساحة التخزين قد تكون ممتلئة).');
      return false;
    }
    setSyncSuccessMsg(message);
    setTimeout(() => setSyncSuccessMsg(null), 6000);
    return true;
  };

  const handleSyncFromSheet = async () => {
    const sheetUrl = getSavedSourceUrl('customerSales');
    if (!sheetUrl) {
      setSyncErrorMsg('لا يوجد رابط Google Sheet محفوظ لمبيعات الأصناف. أضفه من صفحة الإكسل أولًا.');
      return;
    }
    setIsSyncing(true);
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      const result = await fetchCustomerItemSalesFromGoogleSheet(sheetUrl);
      if (result.sales.length === 0) {
        throw new Error(result.errors[0] || 'لم يتم العثور على صفوف مبيعات صالحة في الشيت.');
      }
      applyRecords(
        result.sales,
        `تم تحديث ${result.sales.length.toLocaleString('en-US')} صف مبيعات أصناف من Google Sheets.`
      );
    } catch (error: any) {
      setSyncErrorMsg(error?.message || 'تعذرت مزامنة شيت مبيعات الأصناف.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsSyncing(true);
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      const result = await parseExcelCustomerItemSales(file);
      if (result.sales.length === 0) {
        throw new Error(result.errors[0] || 'لم يتم العثور على صفوف صالحة في الملف.');
      }
      applyRecords(
        result.sales,
        `تم استيراد ${result.sales.length.toLocaleString('en-US')} صف مبيعات أصناف من الملف.`
      );
    } catch (error: any) {
      setSyncErrorMsg(error?.message || 'تعذر قراءة ملف مبيعات الأصناف.');
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const scopedRecords = useMemo(
    () => filterCustomerItemSalesByRBAC(salesRecords, currentUser, users, customers),
    [salesRecords, currentUser, users, customers]
  );

  const enrichedRecords = useMemo(
    () => enrichSalesRecords(scopedRecords, users),
    [scopedRecords, users]
  );

  const filterOptions = useMemo(
    () => getFilterOptions(enrichedRecords),
    [enrichedRecords]
  );

  const quality = useMemo(
    () => buildDataQuality(enrichedRecords, users),
    [enrichedRecords, users]
  );

  const period = useMemo(
    () => buildPeriod(filter, enrichedRecords),
    [filter, enrichedRecords]
  );

  const filteredRecords = useMemo(
    () => filterSalesRecords(enrichedRecords, filter, period),
    [enrichedRecords, filter, period]
  );

  const previousPeriod = useMemo(() => buildPreviousPeriod(period), [period]);
  const comparisonAvailable = Boolean(
    previousPeriod && quality.hasCompleteDates && filteredRecords.length > 0
  );

  const previousRecords = useMemo(
    () => (comparisonAvailable && previousPeriod
      ? filterSalesRecords(enrichedRecords, filter, previousPeriod)
      : []),
    [comparisonAvailable, previousPeriod, enrichedRecords, filter]
  );

  const comparison = useMemo(
    () => (comparisonAvailable && previousPeriod
      ? buildComparison(filteredRecords, previousRecords, previousPeriod)
      : null),
    [comparisonAvailable, filteredRecords, previousRecords, previousPeriod]
  );

  const totals = useMemo(
    () => comparison?.currentTotals || buildTotals(filteredRecords),
    [comparison, filteredRecords]
  );

  const itemAggregates = useMemo(
    () => comparison?.items || buildItemAggregates(filteredRecords),
    [comparison, filteredRecords]
  );

  const customerAggregates = useMemo(
    () => buildCustomerAggregates(filteredRecords, customers, users, previousRecords),
    [filteredRecords, customers, users, previousRecords]
  );

  const previousCustomerAggregates = useMemo(
    () => (comparisonAvailable
      ? buildCustomerAggregates(previousRecords, customers, users)
      : []),
    [comparisonAvailable, previousRecords, customers, users]
  );

  const opportunities = useMemo(
    () => (comparisonAvailable
      ? buildSalesOpportunities(customerAggregates, previousCustomerAggregates)
      : []),
    [comparisonAvailable, customerAggregates, previousCustomerAggregates]
  );

  const comparisonUnavailableReason = useMemo(() => {
    if (period.mode === 'all') return 'اختر فترة محددة لعرض المقارنة بالفترة السابقة.';
    if (filteredRecords.length === 0) return 'لا توجد مبيعات في الفترة المحددة.';
    if (!quality.hasCompleteDates) {
      return `المقارنة غير متاحة: ${quality.undatedRows.toLocaleString('en-US')} صف بدون تاريخ كامل.`;
    }
    if (!previousPeriod) return 'لا توجد فترة سابقة كافية للمقارنة.';
    return undefined;
  }, [period.mode, filteredRecords.length, quality.hasCompleteDates, quality.undatedRows, previousPeriod]);

  const selectedCustomer = useMemo(
    () => customerAggregates.find((customer) => customer.key === selectedCustomerKey) || null,
    [customerAggregates, selectedCustomerKey]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.search.trim()) count += 1;
    if (filter.periodPreset !== 'all') count += 1;
    if (filter.branch !== 'ALL') count += 1;
    if (filter.repName !== 'ALL') count += 1;
    if (filter.supervisorName !== 'ALL') count += 1;
    if (filter.itemGroup !== 'ALL') count += 1;
    return count;
  }, [filter]);

  const canFilterScope = currentUser?.role !== 'sales_rep';
  const canFilterRep = ['admin', 'developer', 'branch_manager', 'supervisor'].includes(currentUser?.role || '');
  const canFilterSupervisor = ['admin', 'developer', 'branch_manager', 'supervisor'].includes(currentUser?.role || '');

  const updateFilter = (patch: Partial<SalesFilterState>) => {
    setFilter((previous) => ({ ...previous, ...patch }));
    setItemPage(1);
    setCustomerPage(1);
  };

  const resetFilters = () => {
    setFilter(INITIAL_FILTER);
    setItemPage(1);
    setCustomerPage(1);
  };

  const handleSortChange = (key: ItemSortKey) => {
    if (key === itemSortKey) {
      setItemSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
    } else {
      setItemSortKey(key);
      setItemSortDirection(key === 'lastPurchase' ? 'desc' : 'desc');
    }
    setItemPage(1);
  };

  const handleSelectItem = (itemKeyOrName: string) => {
    updateFilter({ search: itemKeyOrName });
  };

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    const legacySummaries = aggregateCustomerItemSales(filteredRecords);
    exportCustomerItemSalesToExcel(
      filteredRecords,
      legacySummaries,
      `تحليل_مبيعات_الأصناف_${currentUser?.name || 'الطنطاوي'}`
    );
  };

  const sqlSchemaText = useMemo(() => getCustomerItemSalesSQLSchema(), []);
  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlSchemaText);
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 2500);
    } catch {
      setCopiedSQL(false);
    }
  };

  const customerTotalPages = Math.max(1, Math.ceil(customerAggregates.length / customerPageSize));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const visibleCustomers = customerAggregates.slice(
    (safeCustomerPage - 1) * customerPageSize,
    safeCustomerPage * customerPageSize
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
          <span className="text-xs font-bold">جارٍ تحميل مبيعات الأصناف...</span>
        </div>
      </div>
    );
  }

  if (salesRecords.length === 0) {
    return (
      <div className="item-sales-screen space-y-5 pb-20" dir="rtl">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f2b38] text-white">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900">تحليل مبيعات الأصناف</h1>
              <p className="text-[11px] font-semibold text-slate-500">لا توجد بيانات محفوظة على هذا الجهاز حتى الآن.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-700">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-base font-black text-slate-900">ابدأ بتحميل شيت مبيعات الأصناف</h2>
          <p className="mx-auto mt-1 max-w-xl text-xs font-semibold leading-relaxed text-slate-500">
            الصفحة تعرض البيانات الحقيقية فقط. استخدم مزامنة Google Sheets أو استورد ملف Excel/CSV،
            ولن يتم إنشاء أي بيانات تجريبية.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b38] px-4 py-2.5 text-xs font-black text-white hover:bg-[#163b4d] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>مزامنة من Google Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span>استيراد ملف</span>
            </button>
            {onNavigateToExcel ? (
              <button
                type="button"
                onClick={onNavigateToExcel}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-black text-teal-800 hover:bg-teal-100"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>إعداد رابط الشيت</span>
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleUploadFile}
            className="hidden"
          />
          {syncErrorMsg ? (
            <div className="mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{syncErrorMsg}</span>
            </div>
          ) : null}
          {syncSuccessMsg ? (
            <div className="mx-auto mt-4 flex max-w-xl items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="item-sales-screen space-y-4 pb-20" dir="rtl">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f2b38] text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">تحليل مبيعات الأصناف</h1>
                <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-[10px] font-black text-teal-800">
                  <Sparkles className="h-3 w-3" />
                  <span>قراءة من بيانات الشيت</span>
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-[11px] font-semibold leading-relaxed text-slate-500">
                مبيعات العملاء بالصنف، مع الكميات والقيم وتواريخ آخر شراء، موزعة حسب الفرع والمندوب والمشرف.
                كل المؤشرات تُحسب من الصفوف المفلترة الحالية فقط.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  <span>
                    نطاق الصلاحية: {currentUser?.role === 'sales_rep'
                      ? `مندوب (${currentUser.name})`
                      : currentUser?.role === 'supervisor'
                        ? `مشرف (${currentUser.name})`
                        : currentUser?.role === 'branch_manager'
                          ? 'مدير فرع'
                          : 'إدارة كاملة'}
                  </span>
                </span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{period.label}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
                  {filteredRecords.length.toLocaleString('en-US')} صف / {totals.distinctItems} صنف / {totals.distinctCustomers} عميل
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSyncFromSheet}
              disabled={isSyncing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0f2b38] px-3 text-[10px] font-black text-white transition hover:bg-[#163b4d] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جارٍ المزامنة...' : 'مزامنة'}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSyncing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>استيراد</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تصدير</span>
            </button>
            {onNavigateToExcel ? (
              <button
                type="button"
                onClick={onNavigateToExcel}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-[10px] font-black text-teal-800 transition hover:bg-teal-100"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>الشيت</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsSQLModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-500 transition hover:bg-slate-50"
              title="كود SQL للجدول"
            >
              <Database className="h-3.5 w-3.5" />
              <span>SQL</span>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleUploadFile}
          className="hidden"
        />

        {syncSuccessMsg ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        ) : null}
        {syncErrorMsg ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{syncErrorMsg}</span>
          </div>
        ) : null}
      </section>

      {(quality.undatedRows > 0 || quality.unmappedReps.length > 0 || quality.placeholderItemCode > 0 || quality.missingSalesOrder > 0) ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3">
          <details>
            <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-black text-amber-900">
              <Info className="h-4 w-4" />
              <span>ملاحظات جودة البيانات (قد تؤثر على دقة بعض التحليلات)</span>
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[10px] font-bold leading-relaxed text-amber-900 sm:grid-cols-2">
              {quality.undatedRows > 0 ? (
                <div className="rounded-xl bg-white/80 px-2.5 py-2">
                  {quality.undatedRows.toLocaleString('en-US')} صف بدون تاريخ كامل — الفلترة بالشهر تعمل، لكن النطاق الدقيق والمقارنة لا يشملانها.
                </div>
              ) : null}
              {quality.unmappedReps.length > 0 ? (
                <div className="rounded-xl bg-white/80 px-2.5 py-2">
                  {quality.unmappedReps.length.toLocaleString('en-US')} مندوب غير مرتبط بمشرف — تظهر مبيعاتهم تحت «غير محدد».
                </div>
              ) : null}
              {quality.placeholderItemCode > 0 ? (
                <div className="rounded-xl bg-white/80 px-2.5 py-2">
                  {quality.placeholderItemCode.toLocaleString('en-US')} صف بكود صنف غير متوفر — تم التجميع بالاسم.
                </div>
              ) : null}
              {quality.missingSalesOrder > 0 ? (
                <div className="rounded-xl bg-white/80 px-2.5 py-2">
                  {quality.missingSalesOrder.toLocaleString('en-US')} صف بدون رقم أمر بيع — عدد الأوامر يظهر «—» حيث لا يتوفر.
                </div>
              ) : null}
            </div>
          </details>
        </section>
      ) : null}

      <ItemSalesFilters
        value={filter}
        options={filterOptions}
        onChange={updateFilter}
        onReset={resetFilters}
        canFilterBranch={canFilterScope}
        canFilterRep={canFilterRep}
        canFilterSupervisor={canFilterSupervisor}
        activeCount={activeFilterCount}
      />

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <article className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-white p-3.5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-amber-400 to-amber-200" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-black text-slate-500">إجمالي المبيعات</div>
              <strong className="mt-1 block font-mono text-lg font-black text-slate-900">{formatCurrency(totals.totalAmount)}</strong>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
            <span>مقارنة بالفترة السابقة</span>
            <DeltaBadge value={comparison?.amountDeltaPercent ?? null} />
          </div>
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-white p-3.5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-teal-500 to-teal-200" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-black text-slate-500">عدد العملاء المشترين</div>
              <strong className="mt-1 block font-mono text-lg font-black text-slate-900">{totals.distinctCustomers.toLocaleString('en-US')}</strong>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
            <span>عملاء اشتروا في الفترة</span>
            <span className="font-mono text-[10px] font-black text-slate-600" dir="ltr">
              {comparison ? `${comparison.customersDelta >= 0 ? '+' : ''}${comparison.customersDelta}` : '—'}
            </span>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-white p-3.5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-blue-500 to-blue-200" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] font-black text-slate-500">عدد الأصناف المباعة</div>
              <strong className="mt-1 block font-mono text-lg font-black text-slate-900">{totals.distinctItems.toLocaleString('en-US')}</strong>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
            <span>أصناف مختلفة</span>
            <span className="font-mono text-[10px] font-black text-slate-600" dir="ltr">
              {comparison ? `${comparison.itemsDelta >= 0 ? '+' : ''}${comparison.itemsDelta}` : '—'}
            </span>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-purple-200/80 bg-white p-3.5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-purple-500 to-purple-200" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black text-slate-500">أعلى صنف مبيعًا</div>
              <strong className="mt-1 block truncate text-xs font-black text-slate-900">
                {totals.topItem?.itemName || 'لا توجد مبيعات'}
              </strong>
              <span className="mt-0.5 block font-mono text-[10px] font-bold text-slate-500">
                {totals.topItem ? formatCurrency(totals.topItem.totalAmount) : '—'}
              </span>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1 text-[9px] font-bold text-slate-400">
            <span>{totals.topItem ? `${formatNumber(totals.topItem.totalQuantity)} ${totals.topItem.unit}` : '—'}</span>
            <span className="font-mono text-[10px] font-black text-slate-600" dir="ltr">
              {totals.topItem ? `${totals.topItem.sharePercent.toFixed(1)}%` : '—'}
            </span>
          </div>
        </article>
      </section>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
        <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">إجمالي الكمية: <strong className="font-mono text-slate-800">{formatNumber(totals.totalQuantity)}</strong></span>
        <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">إجمالي القطع المكافئة: <strong className="font-mono text-slate-800">{formatNumber(totals.totalPieces)}</strong></span>
        <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">أوامر البيع: <strong className="font-mono text-slate-800">{totals.ordersTracked ? totals.distinctOrders.toLocaleString('en-US') : '—'}</strong></span>
        <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">متوسط أمر البيع: <strong className="font-mono text-slate-800">{totals.avgOrderValue === null ? '—' : formatCurrency(totals.avgOrderValue)}</strong></span>
        <span className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">الفروع النشطة: <strong className="font-mono text-slate-800">{totals.branchesCount}</strong></span>
      </div>

      {filteredRecords.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-sm font-black text-slate-800">لا توجد نتائج مطابقة</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">جرّب توسيع الفترة أو مسح بعض الفلاتر.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl bg-[#0f2b38] px-4 py-2 text-xs font-black text-white"
          >
            مسح كل الفلاتر
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <ItemSalesItemsTable
              items={itemAggregates}
              sortKey={itemSortKey}
              sortDirection={itemSortDirection}
              onSortChange={handleSortChange}
              page={itemPage}
              pageSize={itemPageSize}
              onPageChange={setItemPage}
              onPageSizeChange={(size) => {
                setItemPageSize(size);
                setItemPage(1);
              }}
              onSelectItem={(item) => handleSelectItem(item.itemName)}
            />

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">أفضل العملاء</h2>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {customerAggregates.length.toLocaleString('en-US')} عميل — اضغط على العميل لعرض التفاصيل
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">مرتبة حسب قيمة المبيعات</span>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-right text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 text-center">#</th>
                      <th className="px-3 py-2.5">العميل</th>
                      <th className="px-3 py-2.5">الفرع</th>
                      <th className="px-3 py-2.5 text-center">المبيعات</th>
                      <th className="px-3 py-2.5 text-center">الأصناف</th>
                      <th className="px-3 py-2.5 text-center">آخر شراء</th>
                      <th className="px-3 py-2.5 text-center">الاتجاه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleCustomers.map((customer, index) => (
                      <tr
                        key={customer.key}
                        onClick={() => setSelectedCustomerKey(customer.key)}
                        className="cursor-pointer transition hover:bg-indigo-50/40"
                      >
                        <td className="px-3 py-2.5 text-center font-mono text-[10px] font-bold text-slate-400">
                          {(safeCustomerPage - 1) * customerPageSize + index + 1}
                        </td>
                        <td className="max-w-[220px] px-3 py-2.5">
                          <div className="truncate font-black text-slate-900">{customer.customerName}</div>
                          <div className="text-[9px] font-semibold text-slate-400">
                            {customer.customerCode || 'بدون كود'} • {customer.assignment.repName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{customer.assignment.branchName}</td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700">{formatCurrency(customer.totalAmount)}</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">{customer.distinctItemsCount}</td>
                        <td className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-600">{customer.lastPurchaseLabel}</td>
                        <td className="px-3 py-2.5 text-center">
                          {customer.trendPercent === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={`font-mono text-[10px] font-black ${customer.trendPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                              {customer.trendPercent >= 0 ? '+' : ''}{customer.trendPercent.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {visibleCustomers.map((customer) => (
                  <button
                    key={customer.key}
                    type="button"
                    onClick={() => setSelectedCustomerKey(customer.key)}
                    className="w-full p-3 text-right transition active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-slate-900">{customer.customerName}</div>
                        <div className="mt-0.5 text-[9px] font-semibold text-slate-400">
                          {customer.customerCode || 'بدون كود'} • {customer.assignment.repName}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] font-black text-emerald-700">
                        {formatCurrency(customer.totalAmount)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
                      <span>{customer.assignment.branchName} • {customer.distinctItemsCount} صنف</span>
                      <span>{customer.lastPurchaseLabel}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 p-3 text-[10px] font-bold text-slate-500">
                <span>صفحة {safeCustomerPage} من {customerTotalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCustomerPage <= 1}
                    onClick={() => setCustomerPage(safeCustomerPage - 1)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <button
                    type="button"
                    disabled={safeCustomerPage >= customerTotalPages}
                    onClick={() => setCustomerPage(safeCustomerPage + 1)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="xl:col-span-4">
            <ItemSalesInsights
              records={filteredRecords}
              items={itemAggregates}
              customers={customerAggregates}
              comparison={comparison}
              comparisonUnavailableReason={comparisonUnavailableReason}
              opportunities={opportunities}
              onSelectCustomer={(customer) => setSelectedCustomerKey(customer.key)}
              onSelectItem={(item) => handleSelectItem(item.itemName)}
            />
          </aside>
        </div>
      )}

      {selectedCustomer ? (
        <ItemSalesCustomerDrawer
          customer={selectedCustomer}
          comparisonAvailable={comparisonAvailable}
          comparisonUnavailableReason={comparisonUnavailableReason}
          onClose={() => setSelectedCustomerKey(null)}
          onOpenNewOrder={onOpenNewOrderForCustomer
            ? (targetCustomer, itemCode) => {
                if (targetCustomer?.id) {
                  onOpenNewOrderForCustomer(targetCustomer, itemCode);
                }
              }
            : undefined}
        />
      ) : null}

      {isSQLModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" dir="rtl">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col space-y-3 rounded-3xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-black">كود SQL لجدول مبيعات الأصناف (PostgreSQL / Supabase)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSQLModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[11px] font-semibold leading-relaxed text-slate-300">
              هذا الكود للعرض فقط ولم يُنفذ من التطبيق. لا تنفذه كما هو قبل مراجعة سياسات RLS؛
              النسخة الحالية تمنح صلاحية كاملة لـ anon وهي غير مناسبة للإنتاج.
            </p>
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <pre className="max-h-[50vh] overflow-y-auto p-4 text-[11px] leading-relaxed text-emerald-400" dir="ltr">
                {sqlSchemaText}
              </pre>
              <button
                type="button"
                onClick={handleCopySQL}
                className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-white/25"
              >
                {copiedSQL ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSQL ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsSQLModalOpen(false)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/20"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomerItemSalesView;
