import assert from 'node:assert/strict';
import { Customer, CustomerItemSaleRecord, User } from '../src/types';
import {
  buildDataQuality,
  buildPeriod,
  enrichSalesRecords,
  filterSalesRecords
} from '../src/services/customerItemSalesAnalytics';
import {
  buildComparison,
  buildCustomerAggregates,
  buildItemAggregates,
  buildSalesOpportunities,
  buildTotals
} from '../src/services/customerItemSalesInsights';

const users = [
  {
    id: 'rep-1', name: 'أحمد علي', username: 'ahmed', email: 'ahmed@example.com',
    role: 'sales_rep', branchName: 'فرع القاهرة', supervisorId: 'sup-1',
    phone: '01000000000', isActive: true, approvalStatus: 'active'
  },
  {
    id: 'sup-1', name: 'محمود المشرف', username: 'mahmoud', email: 'mahmoud@example.com',
    role: 'supervisor', branchName: 'فرع القاهرة',
    phone: '01000000001', isActive: true, approvalStatus: 'active'
  }
] as User[];

const customers = [
  {
    id: 'cust-1', code: 'CUST001', name: 'سوبر ماركت النور',
    branchName: 'فرع القاهرة', repName: 'أحمد علي',
    supervisorName: 'محمود المشرف', phone: '01000000002'
  },
  {
    id: 'cust-2', code: 'CUST002', name: 'معرض الأمانة',
    branchName: 'فرع القاهرة', repName: 'أحمد علي', phone: '01000000003'
  }
] as Customer[];

const records = [
  {
    id: 'r1', customerAccount: 'CUST001', invoicingName: 'سوبر ماركت النور',
    salesOrder: 'SO-1', date: '2026-01-10', repName: 'أحمد علي', month: 1,
    warehouse: 'فرع القاهرة', itemCode: 'IT-1', itemName: 'صنف أ',
    unit: 'كرتونة', factor: 12, unitPrice: 100, discount: 0,
    quantity: 10, amount: 1000, itemGroup: 'مجموعة 1', familyDimension: 'عائلة 1'
  },
  {
    id: 'r2', customerAccount: 'CUST001', invoicingName: 'سوبر ماركت النور',
    salesOrder: 'SO-2', date: '2026-02-10', repName: 'أحمد علي', month: 2,
    warehouse: 'فرع القاهرة', itemCode: 'IT-1', itemName: 'صنف أ',
    unit: 'كرتونة', factor: 12, unitPrice: 100, discount: 0,
    quantity: 20, amount: 2000, itemGroup: 'مجموعة 1', familyDimension: 'عائلة 1'
  },
  {
    id: 'r3', customerAccount: 'CUST001', invoicingName: 'سوبر ماركت النور',
    salesOrder: 'SO-3', date: '2026-01-20', repName: 'أحمد علي', month: 1,
    warehouse: 'فرع القاهرة', itemCode: 'IT-2', itemName: 'صنف ب',
    unit: 'كرتونة', factor: 6, unitPrice: 100, discount: 0,
    quantity: 3, amount: 300, itemGroup: 'مجموعة 2', familyDimension: 'عائلة 2'
  },
  {
    id: 'r4', customerAccount: 'CUST002', invoicingName: 'معرض الأمانة',
    salesOrder: 'SO-4', date: '2026-02-15', repName: 'أحمد علي', month: 2,
    warehouse: 'فرع القاهرة', itemCode: 'IT-2', itemName: 'صنف ب',
    unit: 'كرتونة', factor: 6, unitPrice: 100, discount: 0,
    quantity: 5, amount: 500, itemGroup: 'مجموعة 2', familyDimension: 'عائلة 2'
  },
  {
    id: 'r5', customerAccount: 'CUST-9', invoicingName: 'عميل غير مربوط',
    date: '2026-02-20', repName: 'مندوب غير معروف', month: 2,
    warehouse: 'فرع القاهرة', itemCode: '', itemName: 'صنف بدون كود',
    unit: 'كرتونة', factor: 1, unitPrice: 200, discount: 0,
    quantity: 1, amount: 200, itemGroup: 'مجموعة 1', familyDimension: 'عائلة 1'
  }
] as CustomerItemSaleRecord[];

const enriched = enrichSalesRecords(records, users);
assert.equal(enriched.length, 5);

const filter = {
  search: '',
  periodPreset: 'custom' as const,
  month: 'all' as const,
  customFrom: '2026-02-01',
  customTo: '2026-02-28',
  branch: 'ALL',
  repName: 'ALL',
  supervisorName: 'ALL',
  itemGroup: 'ALL'
};

const period = buildPeriod(filter, enriched);
assert.equal(period.mode, 'range');
assert.equal(period.from, '2026-02-01');
assert.equal(period.to, '2026-02-28');

const current = filterSalesRecords(enriched, filter, period);
assert.equal(current.length, 3, 'February should contain three rows');

const totals = buildTotals(current);
assert.equal(totals.totalAmount, 2700);
assert.equal(totals.distinctCustomers, 3);
assert.equal(totals.distinctItems, 3);
assert.equal(totals.ordersTracked, true);
assert.equal(totals.distinctOrders, 2, 'only real order numbers are counted');

const items = buildItemAggregates(current);
const itemA = items.find((item) => item.itemCode === 'IT-1');
assert.ok(itemA);
assert.equal(itemA?.totalAmount, 2000);
assert.equal(itemA?.customersCount, 1);
assert.equal(itemA?.lastPurchaseDate, '2026-02-10');

const customerAggregates = buildCustomerAggregates(current, customers, users);
const c1 = customerAggregates.find((customer) => customer.customerCode === 'CUST001');
assert.ok(c1);
assert.equal(c1?.assignment.branchName, 'فرع القاهرة');
assert.equal(c1?.assignment.repName, 'أحمد علي');
assert.equal(c1?.assignment.supervisorName, 'محمود المشرف');
assert.equal(c1?.assignment.linkStatus, 'linked');

const previousPeriod = {
  mode: 'range' as const,
  from: '2026-01-01',
  to: '2026-01-31',
  label: 'يناير'
};
const previous = filterSalesRecords(enriched, filter, previousPeriod);
assert.equal(previous.length, 2);

const comparison = buildComparison(current, previous, previousPeriod);
assert.equal(comparison.previousTotals.totalAmount, 1300);
assert.ok((comparison.amountDeltaPercent || 0) > 100);
assert.equal(comparison.topDecliners.length, 0, 'item B grew globally because another customer bought it');

const previousCustomers = buildCustomerAggregates(previous, customers, users);
const opportunities = buildSalesOpportunities(customerAggregates, previousCustomers);
assert.ok(opportunities.some((opportunity) => opportunity.itemName === 'صنف ب'));

const quality = buildDataQuality(enriched, users);
assert.equal(quality.totalRows, 5);
assert.equal(quality.undatedRows, 0);
assert.equal(quality.placeholderCustomerCode, 1);
assert.equal(quality.placeholderItemCode, 1);
assert.equal(quality.hasCompleteDates, true);

const searchResult = filterSalesRecords(
  enriched,
  { ...filter, search: 'IT-2', periodPreset: 'all', customFrom: '', customTo: '' },
  { mode: 'all', label: 'كل الفترة' }
);
assert.equal(searchResult.length, 2, 'search by item name must work');

const supervisorFiltered = filterSalesRecords(
  enriched,
  { ...filter, periodPreset: 'all', supervisorName: 'محمود المشرف' },
  { mode: 'all', label: 'كل الفترة' }
);
assert.equal(supervisorFiltered.length, 4, 'the unmapped rep row must not appear under a supervisor');
assert.deepEqual(quality.unmappedReps, ['مندوب غير معروف']);

const undatedEnriched = enrichSalesRecords(
  [{ ...records[0], id: 'r6', date: '', month: 3, amount: 700, quantity: 7 }],
  users
);
const undatedMarch = buildPeriod(
  { ...filter, periodPreset: 'month', month: 3, customFrom: '', customTo: '' },
  undatedEnriched
);
assert.equal(undatedMarch.mode, 'month');
assert.deepEqual(undatedMarch.months, [3]);
assert.equal(
  filterSalesRecords(undatedEnriched, { ...filter, periodPreset: 'month', month: 3 }, undatedMarch).length,
  1,
  'month filtering must still work when the sheet has no full dates'
);
assert.equal(undatedMarch.year, undefined);

console.log('✓ item sales analytics verification passed');

