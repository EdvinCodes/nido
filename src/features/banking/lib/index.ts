import { enableBankingProvider } from './enablebanking';
import type { BankProvider } from './provider';

export const noneBankProvider: BankProvider = {
  listInstitutions() {
    return Promise.resolve([]);
  },
  createSession() {
    return Promise.reject(new Error('bank_sync_disabled'));
  },
  completeSession() {
    return Promise.resolve([]);
  },
  fetchTransactions() {
    return Promise.resolve([]);
  },
  revoke() {
    return Promise.resolve();
  },
};

export function isBankSyncEnabled(): boolean {
  return process.env.BANK_PROVIDER === 'enablebanking' && Boolean(process.env.BANK_APP_ID);
}

/** Live PSD2 sessions are not wired; env flags only select the stub provider. */
export function isBankConnectReady(): boolean {
  return false;
}

export function getBankProvider(): BankProvider {
  if (process.env.BANK_PROVIDER === 'enablebanking' && process.env.BANK_APP_ID) {
    return enableBankingProvider;
  }
  return noneBankProvider;
}

export type { BankAccountInfo, Institution, RawBankTransaction } from './provider';
