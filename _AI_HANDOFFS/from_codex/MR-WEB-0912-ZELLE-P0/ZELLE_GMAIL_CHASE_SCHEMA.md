# Genuine Gmail Evidence and Matcher Schema

## Real message observed

- Mailbox: authorized `info@missionmedinstitute.com` Gmail account
- Sender displayed by Gmail: `Zelle <Notifications@zellepay.com>`
- Subject: `Kathryn Bolante sent you $1.00 with Zelle`
- Gmail timestamp: September 29, 2026 at 3:25 PM ET
- Body meaning: `Enroll to receive $1.00 from Kathryn Bolante`
- Enrollment address: `info@missionmedinstitute.com`
- Deadline shown: October 9, 2026
- Chase transaction/reference: absent
- Chase incoming-payment confirmation: absent

The message proves that a real sender initiated a transfer, but it does not prove that Mission Global Group/Chase received or deposited the funds.

## Deployed matcher contract

The production HQ matcher queries only:

- sender `no.reply.alerts@chase.com`;
- subject beginning `You received money with Zelle`;
- exact amount;
- exact normalized payer;
- bounded time window;
- unused cryptographic fingerprint.

The enrollment-required message does not satisfy the sender, subject, or deposited-payment semantics. It must not be promoted to paid evidence. The live `not_found` result is therefore correct and safety-preserving.

## Privacy handling

No message body, enrollment token, raw Gmail message ID, credential, or banking secret is copied into this evidence package. Only the minimum fields needed to explain the acceptance result are recorded.
