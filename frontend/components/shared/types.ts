export interface Bill {
  id: number;
  name: string;
  status: 'completed' | 'processing';
  uploadDate: string;
  ocrConfidence: number;
  needsManualVerification?: boolean;
  extractedData: {
    accountDetails: {
      accountNumber: string;
      customerName: string;
      serviceAddress: string;
      meterNumber: string;
      confidence: number;
    };
    billingPeriod: {
      startDate: string;
      endDate: string;
      daysInPeriod: number;
      readingDate: string;
      confidence: number;
    };
    consumption: {
      previousReading: number;
      currentReading: number;
      totalkWh: number;
      unit: string;
      confidence: number;
    };
    charges: Array<{ description: string; amount: number; confidence: number }>;
    totalAmount: number;
    dueDate: string;
    confidence: number;
  };
}
