import * as React from 'react';

export type OfferEmailProps = {
  applicant_name: string;
  program_name: string;
  amount_formatted: string;
  portal_url: string;
  expires_at_formatted: string;
};

export function OfferEmailTemplate(props: OfferEmailProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>USCE Offer Ready</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          Your offer for <strong>{props.program_name}</strong> is ready.
        </p>
        <p>Amount due: {props.amount_formatted}</p>
        <p>Offer expires: {props.expires_at_formatted}</p>
        <p>
          Review and respond: <a href={props.portal_url}>{props.portal_url}</a>
        </p>
      </body>
    </html>
  );
}
