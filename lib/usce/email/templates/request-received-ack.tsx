import * as React from 'react';

export type RequestReceivedAckProps = {
  applicant_name: string;
  program_name: string;
};

export function RequestReceivedAckTemplate(props: RequestReceivedAckProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>We Received Your USCE Request</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          Thank you for your interest in <strong>{props.program_name}</strong>.
        </p>
        <p>Your admissions coordinator will follow up with the next steps.</p>
      </body>
    </html>
  );
}
