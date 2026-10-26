import { Customer, CustomerItemSaleRecord, User } from '../types';
import {
  isArabicNameMatch,
  isBranchMatch,
  normalizeArabicText
} from './arabicMatchingService';
import {
  EnrichedSaleRecord,
  SalesPeriod,
  buildRepDirectory,
  findRepUser,
  formatDateDisplay,
  formatMonthLabel,
  isPlaceholderCode,
  toISODate
} from './customerItemSalesAnalytics';

export interface ItemSalesTotals {
  totalAmount: number;
  totalQuantity: number;
  totalPieces: number;
  distinctItems: number;
  distinctCustomers: number;
  distinctOrders: number;
  ordersTracked: boolean;
  branchesCount: number;
  avgOrderValue: number | null;
  topItem: ItemAggregate | null;
}

export interface ItemAggregate {
  key: string;
  itemCode: string;
  itemName: string;
  itemGroup: string;
  familyDimension: string;
  unit: string;
  factor: number;
  totalQuantity: number;
  totalAmount: number;
  customersCount: number;
  ordersCount: number;
  ordersTracked: boolean;
  avgUnitPrice: number | null;
  sharePercent: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  lastPurchaseLabel: string;
  lastPurchaseSort: number;
  monthlyBreakdown: Record<number, { quantity: number; amount: number }>;
  previousAmount: number;
  previousQuantity: number;
  trendPercent: number | null;
  hasDateCoverage: boolean;
}

export interface CustomerAssignment {
  branchName: string;
  repName: string;
  supervisorName: string;
  linkStatus: 'linked' | 'name_match' | 'unlinked';
  sources: {
    branch: 'master' | 'sales' | 'none';
    rep: 'master' | 'sales' | 'none';
    supervisor: 'users' | 'master' | 'sales' | 'none';
  };
  conflicts: string[];
  branches: string[];
  reps: string[];
  supervisors: string[];
}

export interface CustomerAggregate {
  key: string;
  customerAccount: string;
  customerCode: string;
  customerName: string;
  customerId: string;
  masterCustomer?: Customer;
  assignment: CustomerAssignment;
  totalQuantity: number;
  totalAmount: number;
  totalPieces: number;
  distinctItemsCount: number;
  distinctOrdersCount: number;
  ordersTracked: boolean;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  lastPurchaseLabel: string;
  lastPurchaseSort: number;
  monthlySales: Record<number, number>;
  monthlyQuantities: Record<number, number>;
  groupBreakdown: Record<string, { quantity: number; amount: number; itemsCount: number }>;
  items: ItemAggregate[];
  previousItems: ItemAggregate[];
  purchases: Array<{
    key: string;
    order: string;
    dateLabel: string;
    dateSort: number;
    amount: number;
    itemsCount: number;
  }>;
  previousAmount: number;
  previousQuantity: number;
  trendPercent: number | null;
}

export interface SalesComparison {
  currentTotals: ItemSalesTotals;
  previousTotals: ItemSalesTotals;
  amountDeltaPercent: number | null;
  quantityDeltaPercent: number | null;
  customersDelta: number;
  itemsDelta: number;
  ordersDelta: number;
  items: ItemAggregate[];
  topDecliners: ItemAggregate[];
  topGrowers: ItemAggregate[];
  previousPeriod: SalesPeriod;
}

export interface SalesOpportunity {
  customerKey: string;
  customerAccount: string;
  customerCode: string;
  customerName: string;
  branchName: string;
  repName: string;
  supervisorName: string;
  itemCode: string;
  itemName: string;
  type: 'stopped' | 'declined';
  previousQuantity: number;
  currentQuantity: number;
  previousAmount: number;
  currentAmount: number;
  dropPercent: number;
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);
}

function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  let winner = '';
  let winnerCount = 0;
  counts.forEach((count, value) => {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  });
  return winner;
}

export function buildItemAggregates(
  records: EnrichedSaleRecord[],
  previousRecords: EnrichedSaleRecord[] = []
): ItemAggregate[] {
  const previousMap = new Map<string, { quantity: number; amount: number }>();
  previousRecords.forEach((record) => {
    const current = previousMap.get(record._itemKey) || { quantity: 0, amount: 0 };
    current.quantity += Number(record.quantity) || 0;
    current.amount += Number(record.amount) || 0;
    previousMap.set(record._itemKey, current);
  });

  const map = new Map<string, {
    itemCode: string;
    itemName: string;
    itemGroup: string;
    familyDimension: string;
    unit: string;
    factor: number;
    totalQuantity: number;
    totalAmount: number;
    weightedPrice: number;
    pricedQuantity: number;
    customers: Set<string>;
    orders: Set<string>;
    ordersTracked: boolean;
    firstDate: Date | null;
    lastDate: Date | null;
    lastMonth: number | null;
    monthly: Record<number, { quantity: number; amount: number }>;
  }>();

  records.forEach((record) => {
    const key = record._itemKey;
    if (!key) return;
    const quantity = Number(record.quantity) || 0;
    const amount = Number(record.amount) || 0;
    const unitPrice = Number(record.unitPrice) || 0;
    const factor = Number(record.factor) || 1;

    let item = map.get(key);
    if (!item) {
      item = {
        itemCode: record._isPlaceholderItem ? '' : String(record.itemCode || '').trim(),
        itemName: String(record.itemName || '').trim() || 'صنف غير مسمى',
        itemGroup: String(record.itemGroup || 'عام').trim() || 'عام',
        familyDimension: String(record.familyDimension || record.itemGroup || 'عام').trim() || 'عام',
        unit: String(record.unit || 'كرتونة').trim() || 'كرتونة',
        factor: factor || 1,
        totalQuantity: 0,
        totalAmount: 0,
        weightedPrice: 0,
        pricedQuantity: 0,
        customers: new Set<string>(),
        orders: new Set<string>(),
        ordersTracked: false,
        firstDate: null,
        lastDate: null,
        lastMonth: null,
        monthly: {}
      };
      map.set(key, item);
    }

    item.totalQuantity += quantity;
    item.totalAmount += amount;
    item.factor = Math.max(item.factor, factor || 1);
    item.customers.add(record._customerKey);
    if (record.salesOrder && !isPlaceholderCode(record.salesOrder)) {
      item.orders.add(String(record.salesOrder).trim());
      item.ordersTracked = true;
    }
    if (unitPrice > 0 && quantity > 0) {
      item.weightedPrice += unitPrice * quantity;
      item.pricedQuantity += quantity;
    }
    if (record._date) {
      if (!item.firstDate || record._date < item.firstDate) item.firstDate = record._date;
      if (!item.lastDate || record._date > item.lastDate) item.lastDate = record._date;
    }
    if (record.month) {
      item.lastMonth = item.lastMonth === null ? record.month : Math.max(item.lastMonth, record.month);
    }
    const month = record.month || 1;
    if (!item.monthly[month]) item.monthly[month] = { quantity: 0, amount: 0 };
    item.monthly[month].quantity += quantity;
    item.monthly[month].amount += amount;
  });

  const totalAmount = sumBy(Array.from(map.values()), (item) => item.totalAmount);

  return Array.from(map.entries())
    .map(([key, item]) => {
      const previous = previousMap.get(key);
      const avgUnitPrice =
        item.pricedQuantity > 0
          ? item.weightedPrice / item.pricedQuantity
          : item.totalQuantity > 0
            ? item.totalAmount / item.totalQuantity
            : null;
      const trendPercent =
        previous && previous.amount > 0
          ? ((item.totalAmount - previous.amount) / previous.amount) * 100
          : null;

      return {
        key,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemGroup: item.itemGroup,
        familyDimension: item.familyDimension,
        unit: item.unit,
        factor: item.factor,
        totalQuantity: item.totalQuantity,
        totalAmount: item.totalAmount,
        customersCount: item.customers.size,
        ordersCount: item.orders.size,
        ordersTracked: item.ordersTracked,
        avgUnitPrice,
        sharePercent: totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0,
        firstPurchaseDate: item.firstDate ? toISODate(item.firstDate) : null,
        lastPurchaseDate: item.lastDate ? toISODate(item.lastDate) : null,
        lastPurchaseLabel: item.lastDate
          ? formatDateDisplay(item.lastDate)
          : item.lastMonth
            ? `${formatMonthLabel(item.lastMonth)} (شهر فقط)`
            : 'غير متوفر',
        lastPurchaseSort: item.lastDate ? item.lastDate.getTime() : 0,
        monthlyBreakdown: item.monthly,
        previousAmount: previous?.amount || 0,
        previousQuantity: previous?.quantity || 0,
        trendPercent,
        hasDateCoverage: Boolean(item.lastDate)
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function buildTotals(records: EnrichedSaleRecord[]): ItemSalesTotals {
  const totalAmount = sumBy(records, (record) => record.amount);
  const totalQuantity = sumBy(records, (record) => record.quantity);
  const totalPieces = records.reduce(
    (total, record) => total + (Number(record.quantity) || 0) * (Number(record.factor) || 0),
    0
  );
  const distinctItems = new Set(records.map((record) => record._itemKey)).size;
  const distinctCustomers = new Set(records.map((record) => record._customerKey)).size;
  const orderSet = new Set(
    records
      .map((record) => String(record.salesOrder || '').trim())
      .filter((order) => order && !isPlaceholderCode(order))
  );
  const branchSet = new Set(records.map((record) => record._branch).filter(Boolean));
  const items = buildItemAggregates(records);

  return {
    totalAmount,
    totalQuantity,
    totalPieces,
    distinctItems,
    distinctCustomers,
    distinctOrders: orderSet.size,
    ordersTracked: orderSet.size > 0,
    branchesCount: branchSet.size,
    avgOrderValue: orderSet.size > 0 ? totalAmount / orderSet.size : null,
    topItem: items[0] || null
  };
}

interface CustomerDirectory {
  byCode: Map<string, Customer>;
  byName: Map<string, Customer[]>;
}

function buildCustomerDirectory(customers: Customer[]): CustomerDirectory {
  const byCode = new Map<string, Customer>();
  const byName = new Map<string, Customer[]>();
  (customers || []).forEach((customer) => {
    if (!customer) return;
    const code = String(customer.code || '').trim().toLowerCase();
    if (code) byCode.set(code, customer);
    const name = normalizeArabicText(customer.name);
    if (!name) return;
    const existing = byName.get(name) || [];
    existing.push(customer);
    byName.set(name, existing);
  });
  return { byCode, byName };
}

function findCustomerMaster(
  record: CustomerItemSaleRecord,
  directory: CustomerDirectory
): { customer?: Customer; status: 'linked' | 'name_match' | 'unlinked' } {
  const code = String(record.customerAccount || '').trim().toLowerCase();
  if (code && !isPlaceholderCode(code)) {
    const exact = directory.byCode.get(code);
    if (exact) return { customer: exact, status: 'linked' };
  }

  const nameKey = normalizeArabicText(record.invoicingName);
  if (nameKey) {
    const exactNames = directory.byName.get(nameKey) || [];
    if (exactNames.length > 0) return { customer: exactNames[0], status: 'name_match' };
  }

  return { status: 'unlinked' };
}

function resolveCustomerSupervisor(
  master: Customer | undefined,
  directory: ReturnType<typeof buildRepDirectory>,
  supervisorNames: string[]
): { name: string; source: 'users' | 'master' | 'sales' | 'none' } {
  if (master?.repId || master?.repName || master?.salesRepName) {
    const rep = findRepUser(
      {
        repId: master.repId,
        repName: master.repName || master.salesRepName || ''
      },
      directory
    );
    if (rep?.supervisorId) {
      const supervisor = directory.byId.get(String(rep.supervisorId));
      if (supervisor?.name) return { name: supervisor.name, source: 'users' };
    }
  }

  if (master?.supervisorName) {
    return { name: master.supervisorName, source: 'master' };
  }

  if (supervisorNames.length === 1 && supervisorNames[0] && supervisorNames[0] !== 'غير محدد') {
    return { name: supervisorNames[0], source: 'sales' };
  }

  return { name: 'غير محدد', source: 'none' };
}

export function buildCustomerAggregates(
  records: EnrichedSaleRecord[],
  customers: Customer[],
  users: User[],
  previousRecords: EnrichedSaleRecord[] = []
): CustomerAggregate[] {
  const directory = buildRepDirectory(users);
  const customerDirectory = buildCustomerDirectory(customers);
  const previousByCustomer = new Map<string, EnrichedSaleRecord[]>();
  previousRecords.forEach((record) => {
    const list = previousByCustomer.get(record._customerKey) || [];
    list.push(record);
    previousByCustomer.set(record._customerKey, list);
  });

  const map = new Map<string, {
    records: EnrichedSaleRecord[];
    customerAccount: string;
    customerName: string;
    master?: Customer;
    linkStatus: 'linked' | 'name_match' | 'unlinked';
    totalQuantity: number;
    totalAmount: number;
    totalPieces: number;
    orderSet: Set<string>;
    ordersTracked: boolean;
    firstDate: Date | null;
    lastDate: Date | null;
    lastMonth: number | null;
    monthlySales: Record<number, number>;
    monthlyQuantities: Record<number, number>;
    groupBreakdown: Record<string, { quantity: number; amount: number; itemsCount: number }>;
    branchNames: Set<string>;
    repNames: Set<string>;
    supervisorNames: Set<string>;
  }>();

  records.forEach((record) => {
    const key = record._customerKey;
    if (!key) return;
    let customer = map.get(key);
    if (!customer) {
      const masterMatch = findCustomerMaster(record, customerDirectory);
      customer = {
        records: [],
        customerAccount: record._isPlaceholderCustomer ? '' : String(record.customerAccount || '').trim(),
        customerName: String(record.invoicingName || '').trim() || 'عميل غير مسمى',
        master: masterMatch.customer,
        linkStatus: masterMatch.status,
        totalQuantity: 0,
        totalAmount: 0,
        totalPieces: 0,
        orderSet: new Set<string>(),
        ordersTracked: false,
        firstDate: null,
        lastDate: null,
        lastMonth: null,
        monthlySales: {},
        monthlyQuantities: {},
        groupBreakdown: {},
        branchNames: new Set<string>(),
        repNames: new Set<string>(),
        supervisorNames: new Set<string>()
      };
      map.set(key, customer);
    }

    customer.records.push(record);
    const quantity = Number(record.quantity) || 0;
    const amount = Number(record.amount) || 0;
    customer.totalQuantity += quantity;
    customer.totalAmount += amount;
    customer.totalPieces += quantity * (Number(record.factor) || 0);

    if (record.salesOrder && !isPlaceholderCode(record.salesOrder)) {
      customer.orderSet.add(String(record.salesOrder).trim());
      customer.ordersTracked = true;
    }
    if (record._date) {
      if (!customer.firstDate || record._date < customer.firstDate) customer.firstDate = record._date;
      if (!customer.lastDate || record._date > customer.lastDate) customer.lastDate = record._date;
    }
    if (record.month) {
      customer.lastMonth = customer.lastMonth === null
        ? record.month
        : Math.max(customer.lastMonth, record.month);
    }

    const month = record.month || 1;
    customer.monthlySales[month] = (customer.monthlySales[month] || 0) + amount;
    customer.monthlyQuantities[month] = (customer.monthlyQuantities[month] || 0) + quantity;

    const group = record.itemGroup || 'عام';
    if (!customer.groupBreakdown[group]) {
      customer.groupBreakdown[group] = { quantity: 0, amount: 0, itemsCount: 0 };
    }
    customer.groupBreakdown[group].quantity += quantity;
    customer.groupBreakdown[group].amount += amount;

    if (record._branch && record._branch !== 'غير محدد') customer.branchNames.add(record._branch);
    if (record.repName) customer.repNames.add(record.repName);
    customer.supervisorNames.add(record._supervisorName || 'غير محدد');
  });

  return Array.from(map.entries())
    .map(([key, customer]) => {
      const master = customer.master;
      const branches = Array.from(customer.branchNames);
      const reps = Array.from(customer.repNames);
      const supervisors = Array.from(customer.supervisorNames);

      const masterBranch = String(master?.branchName || '').trim();
      const masterRep = String(master?.salesRepName || master?.repName || '').trim();
      const supervisorInfo = resolveCustomerSupervisor(master, directory, supervisors);

      const branchName = masterBranch || mostFrequent(branches) || 'غير محدد';
      const repName = masterRep || mostFrequent(reps) || 'غير محدد';
      const supervisorName = supervisorInfo.name;

      const conflicts: string[] = [];
      if (masterBranch && branches.length > 0 && !branches.some((branch) => isBranchMatch(branch, masterBranch))) {
        conflicts.push('الفرع المسجل في بطاقة العميل لا يطابق فرع المبيعات');
      }
      if (masterRep && reps.length > 0 && !reps.some((rep) => isArabicNameMatch(rep, masterRep))) {
        conflicts.push('المندوب المسجل في بطاقة العميل لا يطابق مندوب المبيعات');
      }
      if (reps.length > 1) conflicts.push('العميل تعامل مع أكثر من مندوب');
      if (branches.length > 1) conflicts.push('العميل تعامل مع أكثر من فرع');
      if (supervisors.filter((name) => name !== 'غير محدد').length > 1) {
        conflicts.push('العميل مرتبط بأكثر من مشرف');
      }

      const previous = previousByCustomer.get(key) || [];
      const previousAmount = sumBy(previous, (record) => record.amount);
      const previousQuantity = sumBy(previous, (record) => record.quantity);
      const items = buildItemAggregates(customer.records, previous);
      const previousItems = buildItemAggregates(previous);

      const purchaseMap = new Map<string, { order: string; dateLabel: string; dateSort: number; amount: number; items: Set<string> }>();
      customer.records.forEach((record) => {
        const order = String(record.salesOrder || '').trim();
        const dateLabel = record._date
          ? formatDateDisplay(record._date)
          : record.month
            ? `${formatMonthLabel(record.month)} (شهر فقط)`
            : 'غير متوفر';
        const purchaseKey = order || record._dateISO || `month-${record.month || 0}` || dateLabel;
        const existing = purchaseMap.get(purchaseKey) || {
          order,
          dateLabel,
          dateSort: 0,
          amount: 0,
          items: new Set<string>()
        };
        existing.amount += Number(record.amount) || 0;
        existing.dateSort = Math.max(existing.dateSort, record._date ? record._date.getTime() : 0);
        existing.items.add(record._itemKey);
        purchaseMap.set(purchaseKey, existing);
      });

      Object.keys(customer.groupBreakdown).forEach((group) => {
        customer.groupBreakdown[group].itemsCount = items.filter(
          (item) => item.itemGroup === group
        ).length;
      });

      return {
        key,
        customerAccount: customer.customerAccount || customer.customerName,
        customerCode: String(master?.code || customer.customerAccount || '').trim(),
        customerName: String(master?.name || customer.customerName || '').trim() || 'عميل غير مسمى',
        customerId: String(master?.id || ''),
        masterCustomer: master,
        assignment: {
          branchName,
          repName,
          supervisorName,
          linkStatus: customer.linkStatus,
          sources: {
            branch: (masterBranch ? 'master' : branches.length > 0 ? 'sales' : 'none') as 'master' | 'sales' | 'none',
            rep: (masterRep ? 'master' : reps.length > 0 ? 'sales' : 'none') as 'master' | 'sales' | 'none',
            supervisor: supervisorInfo.source
          },
          conflicts,
          branches,
          reps,
          supervisors
        },
        totalQuantity: customer.totalQuantity,
        totalAmount: customer.totalAmount,
        totalPieces: customer.totalPieces,
        distinctItemsCount: items.length,
        distinctOrdersCount: customer.orderSet.size,
        ordersTracked: customer.ordersTracked,
        firstPurchaseDate: customer.firstDate ? toISODate(customer.firstDate) : null,
        lastPurchaseDate: customer.lastDate ? toISODate(customer.lastDate) : null,
        lastPurchaseLabel: customer.lastDate
          ? formatDateDisplay(customer.lastDate)
          : customer.lastMonth
            ? `${formatMonthLabel(customer.lastMonth)} (شهر فقط)`
            : 'غير متوفر',
        lastPurchaseSort: customer.lastDate ? customer.lastDate.getTime() : 0,
        monthlySales: customer.monthlySales,
        monthlyQuantities: customer.monthlyQuantities,
        groupBreakdown: customer.groupBreakdown,
        items,
        previousItems,
        purchases: Array.from(purchaseMap.entries())
          .map(([purchaseKey, purchase]) => ({
            key: purchaseKey,
            order: purchase.order,
            dateLabel: purchase.dateLabel,
            dateSort: purchase.dateSort,
            amount: purchase.amount,
            itemsCount: purchase.items.size
          }))
          .sort((a, b) => (b.dateSort - a.dateSort) || (b.amount - a.amount))
          .slice(0, 12),
        previousAmount,
        previousQuantity,
        trendPercent:
          previousAmount > 0
            ? ((customer.totalAmount - previousAmount) / previousAmount) * 100
            : null
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function buildComparison(
  currentRecords: EnrichedSaleRecord[],
  previousRecords: EnrichedSaleRecord[],
  previousPeriod: SalesPeriod
): SalesComparison {
  const currentTotals = buildTotals(currentRecords);
  const previousTotals = buildTotals(previousRecords);
  const items = buildItemAggregates(currentRecords, previousRecords);
  const previousItems = buildItemAggregates(previousRecords);
  const previousMap = new Map(previousItems.map((item) => [item.key, item]));

  const topDecliners = items
    .filter((item) => item.previousAmount > 0 && item.totalAmount < item.previousAmount)
    .sort((a, b) => (b.previousAmount - b.totalAmount) - (a.previousAmount - a.totalAmount))
    .slice(0, 5);

  const topGrowers = items
    .filter((item) => previousMap.has(item.key) && item.totalAmount > (previousMap.get(item.key)?.totalAmount || 0))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  return {
    currentTotals,
    previousTotals,
    amountDeltaPercent:
      previousTotals.totalAmount > 0
        ? ((currentTotals.totalAmount - previousTotals.totalAmount) / previousTotals.totalAmount) * 100
        : null,
    quantityDeltaPercent:
      previousTotals.totalQuantity > 0
        ? ((currentTotals.totalQuantity - previousTotals.totalQuantity) / previousTotals.totalQuantity) * 100
        : null,
    customersDelta: currentTotals.distinctCustomers - previousTotals.distinctCustomers,
    itemsDelta: currentTotals.distinctItems - previousTotals.distinctItems,
    ordersDelta: currentTotals.distinctOrders - previousTotals.distinctOrders,
    items,
    topDecliners,
    topGrowers,
    previousPeriod
  };
}

export function buildSalesOpportunities(
  currentCustomers: CustomerAggregate[],
  previousCustomers: CustomerAggregate[],
  limit = 8
): SalesOpportunity[] {
  const currentMap = new Map(currentCustomers.map((customer) => [customer.key, customer]));
  const opportunities: SalesOpportunity[] = [];

  previousCustomers.forEach((previousCustomer) => {
    const currentCustomer = currentMap.get(previousCustomer.key);
    previousCustomer.items.forEach((previousItem) => {
      const currentItem = currentCustomer?.items.find((item) => item.key === previousItem.key);
      const currentQuantity = currentItem?.totalQuantity || 0;
      const previousQuantity = previousItem.totalQuantity;
      if (previousQuantity <= 0) return;

      const isStopped = !currentItem || currentQuantity === 0;
      const isDeclined = !isStopped && currentQuantity < previousQuantity * 0.7;
      if (!isStopped && !isDeclined) return;

      const dropPercent =
        previousQuantity > 0
          ? ((previousQuantity - currentQuantity) / previousQuantity) * 100
          : 0;

      opportunities.push({
        customerKey: previousCustomer.key,
        customerAccount: previousCustomer.customerAccount,
        customerCode: previousCustomer.customerCode,
        customerName: previousCustomer.customerName,
        branchName: previousCustomer.assignment.branchName,
        repName: previousCustomer.assignment.repName,
        supervisorName: previousCustomer.assignment.supervisorName,
        itemCode: previousItem.itemCode,
        itemName: previousItem.itemName,
        type: isStopped ? 'stopped' : 'declined',
        previousQuantity,
        currentQuantity,
        previousAmount: previousItem.totalAmount,
        currentAmount: currentItem?.totalAmount || 0,
        dropPercent
      });
    });
  });

  return opportunities
    .sort((a, b) => b.previousAmount - a.previousAmount)
    .slice(0, limit);
}
