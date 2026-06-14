import { supabase } from './client';
import type { PaymentStatus } from '../types/db';

/**
 * Insert a new payment record into Supabase.
 * Requirements: 12.4
 */
export async function insertPayment(paymentData: {
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
}): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    user_id: paymentData.userId,
    razorpay_order_id: paymentData.razorpayOrderId,
    razorpay_payment_id: paymentData.razorpayPaymentId ?? null,
    amount: paymentData.amount,
    currency: paymentData.currency,
    status: paymentData.status,
  });

  if (error) {
    throw new Error(
      `insertPayment failed for order_id=${paymentData.razorpayOrderId}: ${error.message}`
    );
  }
}

/**
 * Update the status (and optionally the payment ID) of an existing payment record.
 * Requirements: 12.4, 12.5
 */
export async function updatePaymentStatus(
  razorpayOrderId: string,
  status: PaymentStatus,
  razorpayPaymentId?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (razorpayPaymentId !== undefined) {
    updates.razorpay_payment_id = razorpayPaymentId;
  }

  const { error } = await supabase
    .from('payments')
    .update(updates)
    .eq('razorpay_order_id', razorpayOrderId);

  if (error) {
    throw new Error(
      `updatePaymentStatus failed for order_id=${razorpayOrderId}: ${error.message}`
    );
  }
}
