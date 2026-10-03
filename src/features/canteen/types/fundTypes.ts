export interface UnitFundInflow {
  id: string;
  date: string;
  amount: number;
  sourceCategory: string; // e.g., 'Govt / BAF Grant', 'Monthly Subscription', 'Unit Welfare Allocation', 'Donation', 'Others'
  paymentMethod: 'CASH' | 'BANK';
  voucherNo?: string;
  receivedFrom?: string;
  description: string;
  createdAt: string;
}

export interface UnitFundExpense {
  id: string;
  date: string;
  amount: number;
  expenseCategory: string; // e.g., 'Office Maintenance', 'Stationery & Printing', 'Official Reception / Tea', 'Sports & Welfare', 'Transport / Fuel', 'Emergency Assistance', 'Others'
  paymentMethod: 'CASH' | 'BANK';
  voucherNo?: string;
  paidTo?: string;
  description: string;
  createdAt: string;
}

export interface UnitFundTransfer {
  id: string;
  date: string;
  amount: number;
  from: 'CASH' | 'BANK';
  to: 'CASH' | 'BANK';
  note?: string;
  createdAt: string;
}

export interface OthersFundCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface OthersFundInflow {
  id: string;
  fundId: string; // References OthersFundCategory.id
  fundName: string;
  date: string;
  amount: number;
  source: string;
  paymentMethod: 'CASH' | 'BANK';
  voucherNo?: string;
  receivedFrom?: string;
  description: string;
  createdAt: string;
}

export interface OthersFundExpense {
  id: string;
  fundId: string; // References OthersFundCategory.id
  fundName: string;
  date: string;
  amount: number;
  category: string;
  paymentMethod: 'CASH' | 'BANK';
  voucherNo?: string;
  paidTo?: string;
  description: string;
  createdAt: string;
}

export interface OthersFundTransfer {
  id: string;
  date: string;
  amount: number;
  fromFundId: string;
  fromFundName: string;
  toFundId: string;
  toFundName: string;
  fromMethod: 'CASH' | 'BANK';
  toMethod: 'CASH' | 'BANK';
  note?: string;
  createdAt: string;
}
