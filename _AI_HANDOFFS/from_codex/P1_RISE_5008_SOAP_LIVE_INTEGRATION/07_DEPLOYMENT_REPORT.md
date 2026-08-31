# SOAP Deployment Report

Migrations 006/007 and the SOAP ingest were applied to the isolated production RISE database. The SOAP receipt is one `NRMP_SOAP_CLOSURE` run with 925 canonical claims and 886 identities at zero spend.

Isolated RISE application candidate deployment `dae9adf5-9c97-4908-97df-1a68e2a5d5cf` and shared HQ candidate deployment `fc09ee0b-540e-49e3-9ece-40fdffe61670` both reached `SUCCESS` and passed provider-level health and anonymous security checks.

Eligible browser QA failed at the deployed WordPress SSO file, which is outside the exact DR-151 accepted hash and lacks the reviewed RISE entitlement fields. The shared HQ and isolated RISE applications were rolled back provider-native:

- Shared HQ: `b109b297-73da-476b-9424-e420bddef87b`, exact prior image `sha256:12d7c914a504241c04899eab74a4aa3b95e4b5ade57cd08b0bbda03f60f02d7d`.
- Isolated RISE: `0580e425-7462-4eb2-9901-f5f5c7cfd03b`, exact prior image `sha256:87ff26522b3cdde1459ad35351c38b436e33749a20da3a1b701f7f16e3c77d2c`.

The active application release is again `rise_rights_safe_hrsa_20260828_716fceb7d0ac` with 26 programs. SOAP canonical evidence remains preserved but is not exposed by the rolled-back application.

