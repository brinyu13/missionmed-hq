import * as React from 'react';

export type OfferReminderProps = {
  applicant_name: string;
  program_name: string;
  portal_url: string;
  hours_remaining: number;
};

export function OfferReminderTemplate(props: OfferReminderProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>Reminder: USCE Offer Awaiting Response</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          Your <strong>{props.program_name}</strong> offer is still open.
        </p>
        <p>Time remaining: {props.hours_remaining} hours</p>
        <p>
          Open portal: <a href={props.portal_url}>{props.portal_url}</a>
        </p>
      </body>
    </html>
  );
}
