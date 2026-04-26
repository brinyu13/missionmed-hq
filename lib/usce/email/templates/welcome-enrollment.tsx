import * as React from 'react';

export type WelcomeEnrollmentProps = {
  applicant_name: string;
  program_name: string;
  magic_link_url: string;
};

export function WelcomeEnrollmentTemplate(props: WelcomeEnrollmentProps) {
  return (
    <html>
      <body style={{ fontFamily: 'Arial, sans-serif', color: '#0f2a44' }}>
        <h2>Welcome to MissionMed USCE</h2>
        <p>Hi {props.applicant_name},</p>
        <p>
          You are enrolled in <strong>{props.program_name}</strong>.
        </p>
        <p>
          First login link: <a href={props.magic_link_url}>{props.magic_link_url}</a>
        </p>
      </body>
    </html>
  );
}
