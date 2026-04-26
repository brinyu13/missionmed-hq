import * as React from 'react';

export type PaymentFailedNoticeProps = {
  applicant_name: string;
  portal_url: string;
  retry_window_minutes: number;
};

export function PaymentFailedNoticeTemplate(props: PaymentFailedNoticeProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>Payment Attempt Failed</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          Your payment did not complete. You can retry within {props.retry_window_minutes}{' '}
          minutes.
        </p>
        <p>
          Retry payment: <a href={props.portal_url}>{props.portal_url}</a>
        </p>
      </body>
    </html>
  );
}
