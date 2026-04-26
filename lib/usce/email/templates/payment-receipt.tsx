import * as React from 'react';

export type PaymentReceiptProps = {
  applicant_name: string;
  program_name: string;
  amount_formatted: string;
  confirmation_id: string;
};

export function PaymentReceiptTemplate(props: PaymentReceiptProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>Payment Receipt</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          We received payment for <strong>{props.program_name}</strong>.
        </p>
        <p>Amount: {props.amount_formatted}</p>
        <p>Confirmation ID: {props.confirmation_id}</p>
      </body>
    </html>
  );
}
