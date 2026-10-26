import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Lightbulb,
  PieChart as PieChartIcon,
  Sparkles,
  TrendingDown
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { formatCurrency } from '../../services/invoiceService';
import {
  CustomerAggregate,
  ItemAggregate,
  SalesComparison,
  SalesOpportunity
} from '../../services/customerItemSalesInsights';
import { EnrichedSaleRecord } from '../../services/customerItemSalesAnalytics';

interface ItemSalesInsightsProps {
  records: EnrichedSaleRecord[];
  items: ItemAggregate[];
  customers: CustomerAggregate[];
  comparison: SalesComparison | null;
  comparisonUnavailableReason?: string;
  opportunities: SalesOpportunity[];
  onSelectCustomer: (customer: CustomerAggregate) => void;
  onSelectItem: (item: ItemAggregate) => void;
}

const COLORS = ['#009488', '#f59e0b', '#3882f6', '#6366f1', '#14b8a6', '#ef4444', '#94a3b8', '#0f2b38'];

function formatNumber(value: number | null | undefined): string {
  return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function shortName(value: string, max = 16): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const BranchDistributionCard: React.FC<{ records: EnrichedSaleRecord[] }> = ({ records }) => {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((record) => {
      const branch = record._branch || 'غير محدد';
      map.set(branch, (map.get(branch) || 0) + (Number(record.amount) || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <PieChartIcon className="h-4 w-4" />
          </span>
          <h3 className="text-xs font-black text-slate-900">توزيع المبيعات حسب الفروع</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400">{data.length} فرع</span>
      </div>

      {data.length === 0 || total <= 0 ? (
        <div className="py-8 text-center text-[11px] font-bold text-slate-400">لا توجد بيانات فروع في الفترة المحددة.</div>
      ) : (
        <>
          <div className="relative h-[190px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value) || 0)}
                  contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: '#e2e8f0', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400">إجمالي المبيعات</span>
              <strong className="font-mono text-sm font-black text-slate-900">{formatCurrency(total)}</strong>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {data.slice(0, 6).map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-2 text-[10px] font-bold">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="shrink-0 font-mono text-slate-500" dir="ltr">
                  {((entry.value / total) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

const TopItemsChartCard: React.FC<{
  items: ItemAggregate[];
  onSelectItem: (item: ItemAggregate) => void;
}> = ({ items, onSelectItem }) => {
  const [metric, setMetric] = useState<'amount' | 'quantity'>('amount');
  const data = useMemo(() => {
    return [...items]
      .filter((item) => (metric === 'amount' ? item.totalAmount > 0 : item.totalQuantity > 0))
      .sort((a, b) =>
        metric === 'amount'
          ? b.totalAmount - a.totalAmount
          : b.totalQuantity - a.totalQuantity
      )
      .slice(0, 5)
      .map((item) => ({
        name: shortName(item.itemName, 18),
        value: metric === 'amount' ? item.totalAmount : item.totalQuantity,
        item
      }));
  }, [items, metric]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-black text-slate-900">أفضل 5 أصناف</h3>
            <p className="text-[10px] font-semibold text-slate-400">مقارنة مباشرة داخل الفترة المحددة</p>
          </div>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setMetric('amount')}
            className={`rounded-md px-2 py-1 text-[10px] font-black transition ${metric === 'amount' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            القيمة
          </button>
          <button
            type="button"
            onClick={() => setMetric('quantity')}
            className={`rounded-md px-2 py-1 text-[10px] font-black transition ${metric === 'quantity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            الكمية
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center text-[11px] font-bold text-slate-400">لا توجد أصناف في الفترة المحددة.</div>
      ) : (
        <div className="h-[210px] w-full" dir="rtl">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 26 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={42}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickFormatter={(value: any) => {
                  const number = Number(value) || 0;
                  if (metric === 'amount' && number >= 1000) return `${Math.round(number / 1000)}k`;
                  return String(Math.round(number));
                }}
                width={34}
              />
              <Tooltip
                formatter={(value: any) =>
                  metric === 'amount'
                    ? formatCurrency(Number(value) || 0)
                    : formatNumber(Number(value) || 0)
                }
                contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: '#e2e8f0', fontSize: 11 }}
              />
              <Bar
                dataKey="value"
                fill="#009488"
                radius={[6, 6, 0, 0]}
                onClick={(entry: any) => {
                  const item = data.find((row) => row.name === entry?.name)?.item;
                  if (item) onSelectItem(item);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

const PeriodAnalysisCard: React.FC<{
  records: EnrichedSaleRecord[];
  customers: CustomerAggregate[];
  comparison: SalesComparison | null;
  comparisonUnavailableReason?: string;
}> = ({ records, customers, comparison, comparisonUnavailableReason }) => {
  const total = records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const topCustomer = customers[0];
  const topCustomerShare = topCustomer && total > 0 ? (topCustomer.totalAmount / total) * 100 : 0;
  const branches = new Set(records.map((record) => record._branch).filter(Boolean)).size;
  const itemsCount = new Set(records.map((record) => record._itemKey)).size;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-xs font-black text-slate-900">تحليل الفترة</h3>
          <p className="text-[10px] font-semibold text-slate-400">مؤشرات التركيز والمقارنة</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-bold text-slate-500">نسبة أعلى عميل</span>
          <strong className="font-mono text-xs font-black text-slate-800" dir="ltr">{topCustomerShare.toFixed(1)}%</strong>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-bold text-slate-500">عدد الفروع النشطة</span>
          <strong className="font-mono text-xs font-black text-slate-800">{branches}</strong>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-[10px] font-bold text-slate-500">متوسط قيمة الصنف</span>
          <strong className="font-mono text-xs font-black text-slate-800">
            {formatCurrency(itemsCount > 0 ? total / itemsCount : 0)}
          </strong>
        </div>

        {comparison ? (
          <>
            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
              <span className="text-[10px] font-bold text-emerald-800">تغير المبيعات</span>
              <span className={`inline-flex items-center gap-1 font-mono text-xs font-black ${(comparison.amountDeltaPercent || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {(comparison.amountDeltaPercent || 0) >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                <span dir="ltr">{comparison.amountDeltaPercent === null ? '—' : `${comparison.amountDeltaPercent.toFixed(1)}%`}</span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
              <span className="text-[10px] font-bold text-blue-800">العملاء الجدد / المفقودون</span>
              <span className="font-mono text-xs font-black text-blue-700" dir="ltr">
                {comparison.customersDelta >= 0 ? '+' : ''}{comparison.customersDelta}
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold leading-relaxed text-slate-500">
            {comparisonUnavailableReason || 'المقارنة غير متاحة لعدم اكتمال التواريخ.'}
          </div>
        )}
      </div>
    </section>
  );
};

const DecliningItemsCard: React.FC<{
  comparison: SalesComparison | null;
  reason?: string;
  onSelectItem: (item: ItemAggregate) => void;
}> = ({ comparison, reason, onSelectItem }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
        <TrendingDown className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-xs font-black text-slate-900">أصناف منخفضة</h3>
        <p className="text-[10px] font-semibold text-slate-400">مقارنة بالفترة السابقة</p>
      </div>
    </div>

    {!comparison ? (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[10px] font-bold leading-relaxed text-slate-500">
        {reason || 'تحتاج هذه البطاقة إلى فترة سابقة مكتملة التواريخ.'}
      </div>
    ) : comparison.topDecliners.length === 0 ? (
      <div className="rounded-xl bg-emerald-50 px-3 py-4 text-[10px] font-bold text-emerald-700">
        لا توجد أصناف منخفضة في الفترة المحددة.
      </div>
    ) : (
      <div className="space-y-1.5">
        {comparison.topDecliners.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectItem(item)}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-right transition hover:bg-rose-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-black text-slate-800">{item.itemName}</span>
              <span className="block font-mono text-[9px] font-bold text-slate-400">{formatCurrency(item.totalAmount)}</span>
            </span>
            <span className="shrink-0 rounded-lg bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-rose-700">
              {item.trendPercent === null ? '—' : `${item.trendPercent.toFixed(1)}%`}
            </span>
          </button>
        ))}
      </div>
    )}
  </section>
);

const OpportunitiesCard: React.FC<{
  opportunities: SalesOpportunity[];
  customers: CustomerAggregate[];
  reason?: string;
  onSelectCustomer: (customer: CustomerAggregate) => void;
}> = ({ opportunities, customers, reason, onSelectCustomer }) => {
  const customerMap = new Map(customers.map((customer) => [customer.key, customer]));

  return (
    <section className="rounded-3xl border border-amber-200/70 bg-gradient-to-b from-amber-50/70 to-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div>
          <h3 className="flex items-center gap-1 text-xs font-black text-slate-900">
            فرص بيع محتملة
            <Sparkles className="h-3 w-3 text-amber-500" />
          </h3>
          <p className="text-[10px] font-semibold text-slate-500">مبنية على سجل شراء العميل نفسه فقط</p>
        </div>
      </div>

      {!reason && opportunities.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-4 text-[10px] font-bold text-emerald-700">
          لا توجد فرص انخفاض أو توقف واضحة في الفترة الحالية.
        </div>
      ) : reason ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 px-3 py-4 text-[10px] font-bold leading-relaxed text-slate-500">
          {reason}
        </div>
      ) : (
        <div className="space-y-1.5">
          {opportunities.slice(0, 5).map((opportunity, index) => {
            const customer = customerMap.get(opportunity.customerKey);
            return (
              <button
                key={`${opportunity.customerKey}-${opportunity.itemName}-${index}`}
                type="button"
                onClick={() => customer && onSelectCustomer(customer)}
                className="w-full rounded-xl border border-slate-100 bg-white px-3 py-2 text-right transition hover:border-amber-200 hover:bg-amber-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] font-black text-slate-800">
                    {opportunity.customerName}
                  </span>
                  <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[9px] font-black ${
                    opportunity.type === 'stopped'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {opportunity.type === 'stopped' ? 'توقف عن الشراء' : 'انخفاض'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500">
                  <span className="truncate">{opportunity.itemName}</span>
                  <span className="shrink-0 font-mono" dir="ltr">
                    {formatNumber(opportunity.previousQuantity)} → {formatNumber(opportunity.currentQuantity)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const ItemSalesInsights: React.FC<ItemSalesInsightsProps> = ({
  records,
  items,
  customers,
  comparison,
  comparisonUnavailableReason,
  opportunities,
  onSelectCustomer,
  onSelectItem
}) => (
  <div className="space-y-4">
    <BranchDistributionCard records={records} />
    <TopItemsChartCard items={items} onSelectItem={onSelectItem} />
    <PeriodAnalysisCard
      records={records}
      customers={customers}
      comparison={comparison}
      comparisonUnavailableReason={comparisonUnavailableReason}
    />
    <DecliningItemsCard
      comparison={comparison}
      reason={comparisonUnavailableReason}
      onSelectItem={onSelectItem}
    />
    <OpportunitiesCard
      opportunities={opportunities}
      customers={customers}
      reason={comparisonUnavailableReason}
      onSelectCustomer={onSelectCustomer}
    />
  </div>
);

export default ItemSalesInsights;

