begin;
insert into missionaccounts.onboarding_email_template_registry(version,subject,html_sha256,text_sha256,manifest_sha256,credential_method,external_send_authorized) values(
 'examprep-onboarding-email-2026-09-17-v3r1','Your MyMissionMed Account is ready',
 '40caf8c4b4a8f70fbe16e347b1357098d397dc50ce313d24ee6a4608d83d4844','22668fae65ad33bcde060a86547a05d400152f0506f376870eb4d6f0193e7282','b6bc9166a7e341200898310bb5c85ed397b190a407f66cf7fba68b231d5da97e',
 'existing-account-or-secure-password-recovery',false
);
commit;
