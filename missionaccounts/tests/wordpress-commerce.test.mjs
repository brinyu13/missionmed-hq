import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Woo lifecycle enforces new checkout prices, private-account offers, course access and rollback', () => {
  const harness = fileURLToPath(new URL('./wordpress-commerce-harness.php', import.meta.url));
  const result = spawnSync('php', [harness], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    live_granted: true,
    live_revoked: true,
    preexisting_preserved: true,
    unrelated_excluded: true,
    drills_granted: true,
    drills_revoked: true,
    new_checkout_price_exact: true,
    grandfathered_renewal_preserved: true,
    checkout_price_validated: true,
    private_offer_issued: true,
    private_offer_bound: true,
    private_offer_wrong_account_blocked: true,
    private_offer_revoked: true,
    ineligible_blocked: true,
  });
});
