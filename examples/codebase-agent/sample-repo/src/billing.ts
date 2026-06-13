export interface BillingSyncJob {
  customerId: string;
  invoiceId: string;
  attempt: number;
}

export async function syncBilling(job: BillingSyncJob): Promise<{ ok: true }> {
  // TODO(fdekit): add retry and idempotency handling before this runs against enterprise renewals.
  await publishBillingEvent('billing.sync.started', job);
  return { ok: true };
}

async function publishBillingEvent(eventName: string, payload: unknown): Promise<void> {
  console.log(eventName, payload);
}
