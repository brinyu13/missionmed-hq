export type PortalOfferStatus =
  | 'SENT'
  | 'REMINDED'
  | 'PENDING_PAYMENT'
  | 'FAILED_PAYMENT'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INVALIDATED'
  | 'PAID'
  | 'ACCEPTED'
  | string;

export type PortalConfirmationStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'ENROLLED'
  | null
  | string;

export type PortalUIState =
  | 'VIEWING_OFFER'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_FAILED'
  | 'RETRY_EXHAUSTED'
  | 'ACCEPTED_PROCESSING'
  | 'ENROLLED'
  | 'DECLINED_CONFIRMED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INVALIDATED';

export function resolvePortalUiState(input: {
  offerStatus: PortalOfferStatus;
  confirmationStatus: PortalConfirmationStatus;
  retryCount: number;
  isTokenExpired: boolean;
}): PortalUIState {
  if (input.isTokenExpired || input.offerStatus === 'EXPIRED') return 'EXPIRED';
  if (input.offerStatus === 'REVOKED') return 'REVOKED';
  if (input.offerStatus === 'INVALIDATED') return 'INVALIDATED';
  if (input.offerStatus === 'DECLINED') return 'DECLINED_CONFIRMED';

  if (
    input.offerStatus === 'PENDING_PAYMENT' &&
    (input.confirmationStatus === 'PENDING_PAYMENT' ||
      input.confirmationStatus === 'PAYMENT_AUTHORIZED')
  ) {
    return 'PAYMENT_REQUIRED';
  }

  if (input.offerStatus === 'FAILED_PAYMENT') {
    return input.retryCount >= 2 ? 'RETRY_EXHAUSTED' : 'PAYMENT_FAILED';
  }

  if (input.confirmationStatus === 'ENROLLED') return 'ENROLLED';
  if (input.confirmationStatus === 'PAYMENT_CAPTURED') return 'ACCEPTED_PROCESSING';

  return 'VIEWING_OFFER';
}
