'use client';

import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Bill } from './types';

interface BillContextValue {
  uploadedBills: Bill[];
  setUploadedBills: Dispatch<SetStateAction<Bill[]>>;
}

const BillContext = createContext<BillContextValue | undefined>(undefined);

export function BillProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BillContextValue;
}) {
  return <BillContext.Provider value={value}>{children}</BillContext.Provider>;
}

export function useBillContext() {
  const context = useContext(BillContext);
  if (!context) {
    throw new Error('useBillContext must be used within a BillProvider');
  }
  return context;
}
