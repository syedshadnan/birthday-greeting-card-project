export type ManualPaymentSubmission = {
  cardId: string
  customerName: string
  payerPhone: string
  paymentMethod: 'bkash' | 'nagad'
  transactionId: string
  amount: number
}

export interface PaymentAdapter {
  readonly name: string
  submit(payment: ManualPaymentSubmission): Promise<void>
}

export function createManualTransferAdapter(
  persist: (payment: ManualPaymentSubmission) => Promise<void>,
): PaymentAdapter {
  return {
    name: 'manual-transfer',
    submit: persist,
  }
}
