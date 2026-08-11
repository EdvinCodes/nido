import type { BankProvider } from './provider';

/** Enable Banking stub — returns empty/errors unless BANK_APP_ID is configured. */
export const enableBankingProvider: BankProvider = {
  listInstitutions(country: string) {
    if (!process.env.BANK_APP_ID) {
      return Promise.reject(new Error('BANK_APP_ID is not configured'));
    }
    void country;
    return Promise.resolve([]);
  },
  createSession(institutionId: string, redirectUrl: string) {
    if (!process.env.BANK_APP_ID) {
      return Promise.reject(new Error('BANK_APP_ID is not configured'));
    }
    void institutionId;
    void redirectUrl;
    return Promise.reject(new Error('Enable Banking integration is not fully configured'));
  },
  completeSession(ref: string) {
    if (!process.env.BANK_APP_ID) {
      return Promise.reject(new Error('BANK_APP_ID is not configured'));
    }
    void ref;
    return Promise.resolve([]);
  },
  fetchTransactions(ref: string, accountId: string, since: Date) {
    if (!process.env.BANK_APP_ID) {
      return Promise.reject(new Error('BANK_APP_ID is not configured'));
    }
    void ref;
    void accountId;
    void since;
    return Promise.resolve([]);
  },
  revoke(ref: string) {
    void ref;
    return Promise.resolve();
  },
};
