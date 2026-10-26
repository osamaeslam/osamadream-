import React, { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Building2,
  CircleDollarSign,
  Info,
  Package,
  Receipt,
  ShoppingCart,
  User,
  UserCheck,
  X
} from 'lucide-react';
import { Customer } from '../../types';
import { formatCurrency } from '../../services/invoiceService';
import { CustomerAggregate, ItemAggregate } from '../../services/customerItemSalesInsights';

interface ItemSalesCustomerDrawerProps {
  customer: CustomerAggregate;
  comparisonAvailable: boolean;
  comparisonUnavailableReason?: string;
  onClose: () => void;
  onOpenNewOrder?: (customer: Customer, itemCode?: string) => void;
}

function formatNumber(value: number | null | undefined): string {
  return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const sourceLabel: Record<string, string> = {
  master: 'بطاقة العميل',
  sales: 'سجل المبيعات',
  users: 'ربط المستخدمين',
  none: 'غير محدد'
};

const linkLabel: Record<CustomerAggregate['assignment']['linkStatus'], string> = {
  linked: 'مرتبط بكود العميل',
  name_match: 'مطابقة بالاسم',
  unlinked: 'غير مرتبط ببطاقة عميل'
};

interface CustomerOpportunity {
  type: 'stopped' | 'declined';
  item: ItemAggregate;
  currentQuantity: number;
}

export const ItemSalesCustomerDrawer: React.FC<ItemSalesCustomerDrawerProps> = ({
  customer,
  comparisonAvailable,
  comparisonUnavailableReason,
  onClose,
  onOpenNewOrder
}) => {
  const opportunities = useMemo<CustomerOpportunity[]>(() => {
    if (!comparisonAvailable) return [];
    const currentMap = new Map(customer.items.map((item) => [item.key, item]));
    const list: CustomerOpportunity[] = [];

    customer.previousItems.forEach((previousItem) => {
      const currentItem = currentMap.get(previousItem.key);
      const currentQuantity = currentItem?.totalQuantity || 0;
      if (previousItem.totalQuantity <= 0) return;
      if (!currentItem || currentQuantity === 0) {
        list.push({ type: 'stopped', item: previousItem, currentQuantity });
      } else if (currentQuantity < previousItem.totalQuantity * 0.7) {
        list.push({ type: 'declined', item: currentItem, currentQuantity });
      }
    });

    return list.sort((a, b) => b.item.previousAmount - a.item.previousAmount).slice(0, 8);
  }, [customer, comparisonAvailable]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const master = customer.masterCustomer;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="is-drawer-in h-full w-full max-w-3xl overflow-y-auto bg-[#f8fafc] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`تفاصيل العميل ${customer.customerName}`}
        dir="rtl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0f2b38] text-base font-black text-white">
                {customer.customerName.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-slate-900">{customer.customerName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-600">
                    كود: {customer.customerCode || 'غير متوفر'}
                  </span>
                  <span className={`rounded-lg px-2 py-0.5 ${
                    customer.assignment.linkStatus === 'linked'
                      ? 'bg-emerald-50 text-emerald-700'
                      : customer.assignment.linkStatus === 'name_match'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                  }`}>
                    {linkLabel[customer.assignment.linkStatus]}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="إغلاق تفاصيل العميل"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                <span>الفرع المسؤول</span>
              </div>
              <div className="mt-1 truncate text-xs font-black text-slate-800">{customer.assignment.branchName}</div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-400">{sourceLabel[customer.assignment.sources.branch]}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                <User className="h-3.5 w-3.5" />
                <span>المندوب المسؤول</span>
              </div>
              <div className="mt-1 truncate text-xs font-black text-slate-800">{customer.assignment.repName}</div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-400">{sourceLabel[customer.assignment.sources.rep]}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
                <UserCheck className="h-3.5 w-3.5" />
                <span>مشرف الفرع</span>
              </div>
              <div className="mt-1 truncate text-xs font-black text-slate-800">{customer.assignment.supervisorName}</div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-400">{sourceLabel[customer.assignment.sources.supervisor]}</div>
            </div>
          </section>

          {customer.assignment.conflicts.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold leading-relaxed text-amber-900">
              <div className="mb-1 flex items-center gap-1.5 font-black">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>ملاحظات على ربط العميل:</span>
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {customer.assignment.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}
              </ul>
            </div>
          ) : null}

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-[#0f2b38] p-3 text-white">
              <div className="flex items-center gap-1 text-[9px] font-bold text-white/60">
                <CircleDollarSign className="h-3 w-3" /><span>إجمالي المبيعات</span>
              </div>
              <strong className="mt-1 block font-mono text-sm font-black">{formatCurrency(customer.totalAmount)}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-[9px] font-bold text-slate-400">الكمية</div>
              <strong className="mt-1 block font-mono text-sm font-black text-slate-800">{formatNumber(customer.totalQuantity)}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-[9px] font-bold text-slate-400">الأصناف</div>
              <strong className="mt-1 block font-mono text-sm font-black text-slate-800">{customer.distinctItemsCount}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-[9px] font-bold text-slate-400">آخر شراء</div>
              <strong className="mt-1 block text-[11px] font-black text-slate-800">{customer.lastPurchaseLabel}</strong>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-teal-700" />
                <h3 className="text-xs font-black text-slate-900">أصناف العميل</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{customer.items.length} صنف</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-right text-[11px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2">الصنف</th>
                    <th className="px-2.5 py-2 text-center">الكمية</th>
                    <th className="px-2.5 py-2 text-center">القيمة</th>
                    <th className="px-2.5 py-2 text-center">النسبة</th>
                    <th className="px-2.5 py-2 text-center">متوسط السعر</th>
                    <th className="px-2.5 py-2 text-center">آخر شراء</th>
                    <th className="px-2.5 py-2 text-center">الاتجاه</th>
                    <th className="px-2.5 py-2 text-center">طلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.items.map((item) => (
                    <tr key={item.key}>
                      <td className="max-w-[220px] px-2.5 py-2">
                        <div className="truncate font-black text-slate-800">{item.itemName}</div>
                        <div className="text-[9px] font-semibold text-slate-400">{item.itemCode || 'بدون كود'}</div>
                      </td>
                      <td className="px-2.5 py-2 text-center font-mono font-bold text-slate-700">{formatNumber(item.totalQuantity)}</td>
                      <td className="px-2.5 py-2 text-center font-mono font-bold text-emerald-700">{formatCurrency(item.totalAmount)}</td>
                      <td className="px-2.5 py-2 text-center font-mono text-slate-500">{item.sharePercent.toFixed(1)}%</td>
                      <td className="px-2.5 py-2 text-center font-mono text-slate-600">{item.avgUnitPrice === null ? '—' : formatCurrency(item.avgUnitPrice)}</td>
                      <td className="px-2.5 py-2 text-center text-[10px] font-bold text-slate-600">{item.lastPurchaseLabel}</td>
                      <td className="px-2.5 py-2 text-center">
                        {item.trendPercent === null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className={`font-mono text-[10px] font-black ${item.trendPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                            {item.trendPercent >= 0 ? '+' : ''}{item.trendPercent.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        {onOpenNewOrder ? (
                          <button
                            type="button"
                            onClick={() => onOpenNewOrder(master || ({} as Customer), item.itemCode || undefined)}
                            className="rounded-lg bg-amber-100 p-1.5 text-amber-800 transition hover:bg-amber-200"
                            aria-label={`طلب ${item.itemName}`}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {customer.items.length === 0 ? (
              <div className="px-3 py-6 text-center text-[10px] font-bold text-slate-400">لا توجد أصناف في الفترة المحددة.</div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-blue-700" />
              <h3 className="text-xs font-black text-slate-900">سجل المشتريات المتاح</h3>
            </div>
            {customer.purchases.length === 0 ? (
              <div className="py-3 text-center text-[10px] font-bold text-slate-400">لا توجد أوامر أو تواريخ شراء متاحة.</div>
            ) : (
              <div className="space-y-1.5">
                {customer.purchases.slice(0, 6).map((purchase) => (
                  <div key={purchase.key} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black text-slate-700">
                        {purchase.order || purchase.dateLabel}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        {purchase.order ? purchase.dateLabel : 'تاريخ/شهر'} • {purchase.itemsCount} صنف
                      </div>
                    </div>
                    <strong className="shrink-0 font-mono text-[11px] font-black text-slate-800">
                      {formatCurrency(purchase.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-amber-700" />
              <h3 className="text-xs font-black text-slate-900">فرص البيع من سجل العميل</h3>
            </div>
            {!comparisonAvailable ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-white/70 px-3 py-3 text-[10px] font-bold leading-relaxed text-slate-500">
                {comparisonUnavailableReason || 'لا يمكن حساب فرص التوقف/الانخفاض بدون فترة سابقة مكتملة التواريخ.'}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-3 text-[10px] font-bold text-emerald-700">
                لا توجد أصناف متوقفة أو منخفضة لهذا العميل في الفترة الحالية.
              </div>
            ) : (
              <div className="space-y-1.5">
                {opportunities.map((opportunity) => (
                  <div key={`${opportunity.type}-${opportunity.item.key}`} className="flex items-center justify-between gap-2 rounded-xl bg-white px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black text-slate-800">{opportunity.item.itemName}</div>
                      <div className="text-[9px] font-bold text-slate-400">
                        {opportunity.type === 'stopped' ? 'لم يشترِه في الفترة الحالية' : 'انخفضت الكمية'} • السابق {formatNumber(opportunity.item.previousQuantity)} / الحالي {formatNumber(opportunity.currentQuantity)}
                      </div>
                    </div>
                    {onOpenNewOrder ? (
                      <button
                        type="button"
                        onClick={() => onOpenNewOrder(master || ({} as Customer), opportunity.item.itemCode || undefined)}
                        className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-[9px] font-black text-white hover:bg-amber-400"
                      >
                        طلب
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[9px] font-bold leading-relaxed text-slate-400">
              الأرقام محسوبة من صفوف مبيعات الأصناف الحالية فقط، دون إعادة حساب أي مبلغ أو ضريبة.
            </p>
            <div className="flex items-center gap-2">
              {onOpenNewOrder ? (
                <button
                  type="button"
                  onClick={() => onOpenNewOrder(master || ({} as Customer))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f2b38] px-3 py-2 text-[10px] font-black text-white hover:bg-[#163b4d]"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>طلب جديد للعميل</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ItemSalesCustomerDrawer;


