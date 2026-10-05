begin;
insert into missionaccounts.onboarding_email_template_registry(version,subject,html_sha256,text_sha256,manifest_sha256,credential_method,external_send_authorized) values(
 'examprep-onboarding-email-2026-09-17-v3r1','Your MyMissionMed Account is ready',
 '40caf8c4b4a8f70fbe16e347b1357098d397dc50ce313d24ee6a4608d83d4844','22668fae65ad33bcde060a86547a05d400152f0506f376870eb4d6f0193e7282','6a73d3d1e04a3bc6d733b47ada12f8d7d068fa47ff169c2587b763727f0076f8',
 'existing-account-or-secure-password-recovery',false
);
commit;
