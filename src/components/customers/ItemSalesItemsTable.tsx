import React, { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Package,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { formatCurrency } from '../../services/invoiceService';
import { ItemAggregate } from '../../services/customerItemSalesInsights';

export type ItemSortKey = 'amount' | 'quantity' | 'customers' | 'avgPrice' | 'lastPurchase';

interface ItemSalesItemsTableProps {
  items: ItemAggregate[];
  sortKey: ItemSortKey;
  sortDirection: 'asc' | 'desc';
  onSortChange: (key: ItemSortKey) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectItem?: (item: ItemAggregate) => void;
}

function formatNumber(value: number | null | undefined): string {
  return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const TrendBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[11px] text-slate-400 font-bold">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black ${
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
      title="مقارنة بالفترة السابقة"
    >
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      <span dir="ltr">{positive ? '+' : ''}{value.toFixed(1)}%</span>
    </span>
  );
};

const SortButton: React.FC<{
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onClick: () => void;
  align?: 'right' | 'center';
}> = ({ label, active, direction, onClick, align = 'right' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 font-black transition ${
      active ? 'text-[#0f2b38]' : 'text-slate-500 hover:text-slate-800'
    } ${align === 'center' ? 'justify-center w-full' : ''}`}
    aria-label={`ترتيب حسب ${label}`}
  >
    <span>{label}</span>
    {active ? (
      direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
    )}
  </button>
);

export const ItemSalesItemsTable: React.FC<ItemSalesItemsTableProps> = ({
  items,
  sortKey,
  sortDirection,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectItem
}) => {
  const sorted = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      switch (sortKey) {
        case 'quantity':
          return (a.totalQuantity - b.totalQuantity) * direction;
        case 'customers':
          return (a.customersCount - b.customersCount) * direction;
        case 'avgPrice':
          return ((a.avgUnitPrice || 0) - (b.avgUnitPrice || 0)) * direction;
        case 'lastPurchase':
          return (a.lastPurchaseSort - b.lastPurchaseSort) * direction;
        case 'amount':
        default:
          return (a.totalAmount - b.totalAmount) * direction;
      }
    });
  }, [items, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(sorted.length, safePage * pageSize);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Package className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-900">الأصناف الأكثر مبيعًا</h2>
            <p className="text-[11px] font-semibold text-slate-500">
              {sorted.length.toLocaleString('en-US')} صنف مطابق للفلاتر الحالية
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span>ترتيب حسب:</span>
          <select
            value={sortKey}
            onChange={(event) => onSortChange(event.target.value as ItemSortKey)}
            className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-black text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="amount">قيمة المبيعات</option>
            <option value="quantity">الكمية المباعة</option>
            <option value="customers">عدد العملاء</option>
            <option value="avgPrice">متوسط سعر الوحدة</option>
            <option value="lastPurchase">آخر شراء</option>
          </select>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-right text-xs">
          <thead className="bg-slate-50/90 text-[11px] text-slate-500">
            <tr>
              <th className="px-3 py-3 text-center font-black">#</th>
              <th className="px-3 py-3 font-black">الصنف</th>
              <th className="px-3 py-3 text-center font-black">
                <SortButton label="الكمية" active={sortKey === 'quantity'} direction={sortDirection} onClick={() => onSortChange('quantity')} align="center" />
              </th>
              <th className="px-3 py-3 text-center font-black">
                <SortButton label="قيمة المبيعات" active={sortKey === 'amount'} direction={sortDirection} onClick={() => onSortChange('amount')} align="center" />
              </th>
              <th className="px-3 py-3 text-center font-black">النسبة</th>
              <th className="px-3 py-3 text-center font-black">
                <SortButton label="عدد العملاء" active={sortKey === 'customers'} direction={sortDirection} onClick={() => onSortChange('customers')} align="center" />
              </th>
              <th className="px-3 py-3 text-center font-black">
                <SortButton label="متوسط سعر الوحدة" active={sortKey === 'avgPrice'} direction={sortDirection} onClick={() => onSortChange('avgPrice')} align="center" />
              </th>
              <th className="px-3 py-3 text-center font-black">
                <SortButton label="آخر شراء" active={sortKey === 'lastPurchase'} direction={sortDirection} onClick={() => onSortChange('lastPurchase')} align="center" />
              </th>
              <th className="px-3 py-3 text-center font-black">الاتجاه</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.map((item, index) => (
              <tr
                key={item.key}
                onClick={() => onSelectItem?.(item)}
                className={`transition ${onSelectItem ? 'cursor-pointer hover:bg-teal-50/40' : ''}`}
              >
                <td className="px-3 py-3 text-center font-mono text-[11px] font-bold text-slate-400">
                  {(safePage - 1) * pageSize + index + 1}
                </td>
                <td className="max-w-[280px] px-3 py-3">
                  <div className="font-black text-slate-900">{item.itemName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    {item.itemCode ? <span className="font-mono">{item.itemCode}</span> : <span>بدون كود</span>}
                    <span>•</span>
                    <span>{item.itemGroup}</span>
                    {item.unit ? <><span>•</span><span>{item.unit}</span></> : null}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-mono font-black text-slate-800">
                  {formatNumber(item.totalQuantity)}
                </td>
                <td className="px-3 py-3 text-center font-mono font-black text-emerald-700">
                  {formatCurrency(item.totalAmount)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="inline-flex min-w-[52px] justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-700">
                    {item.sharePercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">
                  {item.customersCount.toLocaleString('en-US')}
                </td>
                <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">
                  {item.avgUnitPrice === null ? '—' : formatCurrency(item.avgUnitPrice)}
                </td>
                <td className="px-3 py-3 text-center text-[11px] font-bold text-slate-600">
                  {item.lastPurchaseLabel}
                </td>
                <td className="px-3 py-3 text-center">
                  <TrendBadge value={item.trendPercent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {pageItems.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectItem?.(item)}
            className="w-full p-3.5 text-right transition active:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-slate-900">{item.itemName}</div>
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  {item.itemCode || 'بدون كود'} • {item.itemGroup}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] font-black text-slate-500">
                #{(safePage - 1) * pageSize + index + 1}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl bg-emerald-50/70 px-2.5 py-2">
                <span className="block text-[9px] font-bold text-emerald-700/70">قيمة المبيعات</span>
                <strong className="font-mono text-emerald-800">{formatCurrency(item.totalAmount)}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <span className="block text-[9px] font-bold text-slate-500">الكمية</span>
                <strong className="font-mono text-slate-800">{formatNumber(item.totalQuantity)}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <span className="block text-[9px] font-bold text-slate-500">عدد العملاء</span>
                <strong className="font-mono text-slate-800">{item.customersCount}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                <span className="block text-[9px] font-bold text-slate-500">آخر شراء</span>
                <strong className="text-slate-800">{item.lastPurchaseLabel}</strong>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>متوسط سعر الوحدة: {item.avgUnitPrice === null ? '—' : formatCurrency(item.avgUnitPrice)}</span>
              <TrendBadge value={item.trendPercent} />
            </div>
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="px-4 py-10 text-center text-xs font-bold text-slate-400">
          لا توجد أصناف مطابقة للفلاتر الحالية.
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span>عرض</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>من {sorted.length.toLocaleString('en-US')} — {start}-{end}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-16 text-center font-mono text-[11px] font-black text-slate-600">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ItemSalesItemsTable;


