export type Institution = {
  id: string;
  name: string;
  logoUrl?: string;
  country: string;
};

export type BankAccountInfo = {
  externalId: string;
  ibanLast4?: string;
  name: string;
  currency: string;
  balanceMinor?: bigint;
};

export type RawBankTransaction = {
  externalId: string;
  bookedOn: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  merchant?: string;
};

export interface BankProvider {
  listInstitutions(country: string): Promise<Institution[]>;
  createSession(institutionId: string, redirectUrl: string): Promise<{ url: string; ref: string }>;
  completeSession(ref: string): Promise<BankAccountInfo[]>;
  fetchTransactions(ref: string, accountId: string, since: Date): Promise<RawBankTransaction[]>;
  revoke(ref: string): Promise<void>;
}
