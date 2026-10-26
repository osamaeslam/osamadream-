import React from 'react';
import {
  CalendarDays,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  UserCheck,
  X
} from 'lucide-react';
import { FilterOptions, SalesFilterState, formatMonthLabel } from '../../services/customerItemSalesAnalytics';

interface ItemSalesFiltersProps {
  value: SalesFilterState;
  options: FilterOptions;
  onChange: (patch: Partial<SalesFilterState>) => void;
  onReset: () => void;
  canFilterBranch: boolean;
  canFilterRep: boolean;
  canFilterSupervisor: boolean;
  activeCount: number;
}

const SelectField: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ label, icon, value, onChange, children, disabled }) => (
  <label className="flex min-w-[130px] flex-col gap-1">
    <span className="flex items-center gap-1 text-[10px] font-black text-slate-500">
      {icon}
      <span>{label}</span>
    </span>
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-black text-slate-700 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </select>
  </label>
);

export const ItemSalesFilters: React.FC<ItemSalesFiltersProps> = ({
  value,
  options,
  onChange,
  onReset,
  canFilterBranch,
  canFilterRep,
  canFilterSupervisor,
  activeCount
}) => {
  const showMonth = value.periodPreset === 'month';
  const showCustom = value.periodPreset === 'custom';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="relative min-w-0 flex-1">
          <label className="mb-1 flex items-center gap-1 text-[10px] font-black text-slate-500">
            <Search className="h-3 w-3" />
            <span>بحث سريع</span>
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={value.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="اسم العميل، كود العميل، اسم الصنف، كود الصنف..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-9 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            />
            {value.search ? (
              <button
                type="button"
                onClick={() => onChange({ search: '' })}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="مسح البحث"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:flex-none xl:flex-wrap xl:items-end">
          <SelectField
            label="الفترة الزمنية"
            icon={<CalendarDays className="h-3 w-3" />}
            value={value.periodPreset}
            onChange={(periodPreset) => onChange({ periodPreset: periodPreset as SalesFilterState['periodPreset'] })}
          >
            <option value="all">كل الفترة</option>
            {options.hasDates ? <option value="latest_month">آخر شهر في البيانات</option> : null}
            {options.hasDates ? <option value="last_3_months">آخر 3 شهور</option> : null}
            {options.hasDates ? <option value="last_6_months">آخر 6 شهور</option> : null}
            {options.hasDates ? <option value="this_year">سنة {options.maxDate?.getFullYear()}</option> : null}
            <option value="month">شهر محدد</option>
            {options.hasDates ? <option value="custom">نطاق مخصص</option> : null}
          </SelectField>

          {showMonth ? (
            <SelectField
              label="الشهر"
              icon={<CalendarDays className="h-3 w-3" />}
              value={String(value.month)}
              onChange={(month) => onChange({ month: month === 'all' ? 'all' : Number(month) })}
            >
              <option value="all">كل الشهور</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </SelectField>
          ) : null}

          {canFilterBranch ? (
            <SelectField
              label="الفرع"
              icon={<MapPin className="h-3 w-3" />}
              value={value.branch}
              onChange={(branch) => onChange({ branch })}
            >
              <option value="ALL">كل الفروع</option>
              {options.branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </SelectField>
          ) : null}

          {canFilterRep ? (
            <SelectField
              label="المندوب"
              icon={<User className="h-3 w-3" />}
              value={value.repName}
              onChange={(repName) => onChange({ repName })}
            >
              <option value="ALL">كل المناديب</option>
              {options.reps.map((rep) => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </SelectField>
          ) : null}

          {canFilterSupervisor ? (
            <SelectField
              label="مشرف الفرع"
              icon={<UserCheck className="h-3 w-3" />}
              value={value.supervisorName}
              onChange={(supervisorName) => onChange({ supervisorName })}
            >
              <option value="ALL">كل المشرفين</option>
              {options.supervisors.map((supervisor) => (
                <option key={supervisor} value={supervisor}>{supervisor}</option>
              ))}
            </SelectField>
          ) : null}

          <SelectField
            label="مجموعة الصنف"
            icon={<Layers className="h-3 w-3" />}
            value={value.itemGroup}
            onChange={(itemGroup) => onChange({ itemGroup })}
          >
            <option value="ALL">كل المجموعات</option>
            {options.groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </SelectField>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>مسح {activeCount > 0 ? `(${activeCount})` : ''}</span>
        </button>
      </div>

      {showCustom ? (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500">من تاريخ</span>
            <input
              type="date"
              value={value.customFrom}
              onChange={(event) => onChange({ customFrom: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500">إلى تاريخ</span>
            <input
              type="date"
              value={value.customTo}
              onChange={(event) => onChange({ customTo: event.target.value })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
        </div>
      ) : null}

      {activeCount > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 text-[10px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1 text-slate-400">
            <SlidersHorizontal className="h-3 w-3" />
            <span>فلاتر نشطة:</span>
          </span>
          {value.search ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800">بحث: {value.search}</span> : null}
          {value.branch !== 'ALL' ? <span className="rounded-lg bg-teal-50 px-2 py-1 text-teal-800">{value.branch}</span> : null}
          {value.repName !== 'ALL' ? <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-800">{value.repName}</span> : null}
          {value.supervisorName !== 'ALL' ? <span className="rounded-lg bg-purple-50 px-2 py-1 text-purple-800">{value.supervisorName}</span> : null}
          {value.itemGroup !== 'ALL' ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">{value.itemGroup}</span> : null}
          {value.periodPreset !== 'all' ? <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">فترة محددة</span> : null}
        </div>
      ) : null}
    </section>
  );
};

export default ItemSalesFilters;
