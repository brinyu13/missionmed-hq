<?php
declare(strict_types=1);
// Synthetic financial facts only. Exact candidate class, real isolated MariaDB.
require dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingWooAllocator.php';
$testedAllocatorSha = hash_file('sha256', dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingWooAllocator.php');
const FIXTURE_NOW = 1792400000;
const FIXTURE_TABLE = 'fixture_mmed_coaching_allocations';
const DB_NAME = 'fixture_coaching';

function connection(bool $database = true): PDO {
    $port = getenv('MM_TEST_DB_PORT'); $password = getenv('MM_TEST_DB_PASSWORD');
    if (!is_string($port) || !preg_match('/^[0-9]{1,5}$/D', $port) || !is_string($password) || strlen($password) < 32) { throw new RuntimeException('isolated_fixture_configuration_required'); }
    return new PDO('mysql:host=127.0.0.1;port=' . $port . ($database ? ';dbname=fixture_coaching' : '') . ';charset=utf8mb4', 'root', $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
}
final class WpdbPdoFixture {
    public string $prefix = 'fixture_'; public string $last_error = '';
    public array $runtimeQueries = [];
    public $metadataFilter = null;
    public string $usermeta = 'fixture_usermeta';
    public function get_col(string $sql): array {
        if (!str_starts_with($sql, 'SELECT meta_value FROM fixture_usermeta WHERE user_id=')) { throw new RuntimeException('fixture_metadata_read_scope'); }
        return [serialize(['existing_fixture_module'])];
    }
    public function __construct(public PDO $pdo) {}
    public function prepare(string $sql, ...$args): string {
        if (count($args) === 1 && is_array($args[0])) { $args = $args[0]; }
        $index = 0;
        $result = preg_replace_callback('/%[sd]/', function ($match) use (&$index, $args): string {
            if (!array_key_exists($index, $args)) { throw new RuntimeException('fixture_placeholder_mismatch'); }
            $value = $args[$index++]; return $match[0] === '%d' ? (string) (int) $value : $this->pdo->quote((string) $value);
        }, $sql);
        if ($index !== count($args)) { throw new RuntimeException('fixture_placeholder_mismatch'); }
        return $result;
    }
    public function query(string $sql) {
        $this->runtimeQueries[] = $sql;
        $this->last_error = '';
        try { return $this->pdo->exec($sql); } catch (Throwable $e) { $this->last_error = 'isolated_database_error'; return false; }
    }
    public function get_var(string $sql) {
        $this->last_error = '';
        if ($sql === 'SELECT DATABASE()' && $this->metadataFilter !== null) {
            return ($this->metadataFilter)($sql, $this->pdo->query($sql)->fetchColumn(), $this);
        }
        try { $value = $this->pdo->query($sql)->fetchColumn(); return $value === false ? null : $value; } catch (Throwable $e) { $this->last_error = 'isolated_database_error'; return null; }
    }
    public function get_row(string $sql, string $mode) {
        $this->last_error = '';
        try {
            $row = $this->pdo->query($sql)->fetch(PDO::FETCH_ASSOC); $row = $row === false ? null : $row;
            return $this->metadataFilter !== null && str_contains($sql, 'information_schema.') ? ($this->metadataFilter)($sql, $row, $this) : $row;
        } catch (Throwable $e) { $this->last_error = 'isolated_database_error'; return null; }
    }
    public function get_results(string $sql, string $mode) {
        $this->last_error = '';
        try {
            $rows = $this->pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            return $this->metadataFilter !== null ? ($this->metadataFilter)($sql, $rows, $this) : $rows;
        } catch (Throwable $e) { $this->last_error = 'isolated_database_error'; return null; }
    }
}
function at(PDO $pdo, int $now): void { $pdo->exec('SET timestamp=' . $now); }
function snapshot(int $id, string $gateway = 'bacs', bool $promo = true, ?int $created = null): array {
    $s = ['order_id' => (string) $id, 'order_item_id' => (string) ($id + 100000), 'wp_customer_id' => 42, 'product_id' => 900001, 'sku' => 'single', 'gateway' => $gateway, 'quantity' => 1, 'currency' => 'USD', 'tuition_cents' => $promo ? 24900 : 39900, 'total_cents' => $promo ? 24900 : 39900, 'fee_cents' => 0, 'tax_cents' => 0, 'coupon' => $promo ? 'MATCHREADY2026' : '', 'order_created_at' => gmdate('Y-m-d\TH:i:s\Z', $created ?? FIXTURE_NOW)];
    $s['snapshot_digest'] = hash('sha256', json_encode($s, JSON_THROW_ON_ERROR)); return $s;
}
function rehash(array $s): array { unset($s['snapshot_digest']); $s['snapshot_digest'] = hash('sha256', json_encode($s, JSON_THROW_ON_ERROR)); return $s; }
function fingerprint(int $id): string { return hash('sha256', 'SIMULATED_FINANCIAL_FACT_ONLY:' . $id); }
$count = 0;
function check(bool $ok, string $label): void { global $count; ++$count; if (!$ok) { throw new RuntimeException('assertion:' . $label); } }
function rejects(callable $call, string $label): void { try { $call(); } catch (DomainException|RuntimeException $e) { check(true, $label); return; } check(false, $label); }
function resetRows(PDO $pdo): void { $pdo->exec("DELETE FROM `fixture_mmed_coaching_allocations` WHERE allocation_key <> 'campaign:MATCHREADY2026'"); at($pdo, FIXTURE_NOW); }
function scalar(PDO $pdo, string $sql): int { return (int) $pdo->query($sql)->fetchColumn(); }

try {
    if (($argv[1] ?? '') === '--probe') { connection(false); exit(0); }
    if (($argv[1] ?? '') === '--race-worker') {
        $pdo = connection(); at($pdo, FIXTURE_NOW); $allocator = new CoachingWooAllocator(new WpdbPdoFixture($pdo));
        $id = (int) ($argv[2] ?? 0); $start = (float) ($argv[3] ?? 0);
        while (microtime(true) < $start) { usleep(1000); }
        $mode = $argv[4] ?? 'reserve';
        try {
            $s = snapshot($id, $mode === 'reserve' ? 'bacs' : 'stripe');
            if ($mode === 'init') { $allocator->reserve($s); $row = $allocator->beginStripeInitialization($s); }
            elseif ($mode === 'cancel') { $row = $allocator->releaseCanceledStripe($s, ['id'=>'pi_SIMULATED' . $id,'status'=>'canceled','amount'=>$s['total_cents'],'amount_received'=>0,'currency'=>'usd','order_binding_verified'=>true]); }
            elseif ($mode === 'settle') { $row = $allocator->beginSettlement($s, fingerprint($id)); }
            else { $row = $allocator->reserve($s); }
            echo json_encode(['ok' => true, 'order' => (int) $row['order_id'], 'state' => $row['state']]);
        }
        catch (DomainException $e) { echo json_encode(['ok' => false, 'code' => $e->getMessage() === 'coaching_promotion_unavailable' ? 'cap' : 'domain']); }
        exit(0);
    }
    $rootPdo = connection(false); $rootPdo->exec('CREATE DATABASE `fixture_coaching` CHARACTER SET utf8mb4'); unset($rootPdo);
    $pdo = connection(); $db = new WpdbPdoFixture($pdo); $allocator = new CoachingWooAllocator($db);
    check(str_starts_with((string) $pdo->query('SELECT VERSION()')->fetchColumn(), '11.4.'), 'MariaDB11.4 real engine');
    foreach ($allocator->installationSql() as $sql) { $pdo->exec($sql); }
    at($pdo, FIXTURE_NOW);
    check(scalar($pdo, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='fixture_coaching' AND table_name='fixture_mmed_coaching_allocations' AND engine='InnoDB'") === 1, 'isolated InnoDB table');
    $allocator->assertSchema();
    check($db->runtimeQueries === [], 'valid schema check is read only');

    // Faults alter only the metadata returned by this PDO shim. The baseline
    // metadata and row readback come from this real isolated MariaDB instance.
    $schemaFaults = [
        'engine' => ['TABLES', 'coaching_transactional_schema_required', static function ($r) { $r['ENGINE'] = 'MyISAM'; return $r; }],
        'charset' => ['TABLES', 'coaching_transactional_schema_required', static function ($r) { $r['TABLE_COLLATION'] = 'utf8mb4_general_ci'; return $r; }],
        'column nullable' => ['COLUMNS', 'coaching_columns_mismatch', static function ($r) { $r[0]['IS_NULLABLE'] = 'YES'; return $r; }],
        'column type' => ['COLUMNS', 'coaching_columns_mismatch', static function ($r) { $r[2]['COLUMN_TYPE'] = 'bigint'; return $r; }],
        'column charset' => ['COLUMNS', 'coaching_columns_mismatch', static function ($r) { $r[0]['COLLATION_NAME'] = 'ascii_general_ci'; return $r; }],
        'missing column' => ['COLUMNS', 'coaching_columns_mismatch', static function ($r) { array_pop($r); return $r; }],
        'extra column' => ['COLUMNS', 'coaching_columns_mismatch', static function ($r) { $r[] = $r[0]; return $r; }],
        'nonunique binding' => ['STATISTICS', 'coaching_unique_indexes_required', static function ($r) { foreach ($r as &$i) { if ($i['INDEX_NAME'] === 'order_binding') { $i['NON_UNIQUE'] = 1; } } return $r; }],
        'missing unique binding' => ['STATISTICS', 'coaching_unique_indexes_required', static function ($r) { return array_values(array_filter($r, static fn($i) => $i['INDEX_NAME'] !== 'payment_binding')); }],
        'prefix unique binding' => ['STATISTICS', 'coaching_unique_indexes_required', static function ($r) { foreach ($r as &$i) { if ($i['INDEX_NAME'] === 'payment_binding') { $i['SUB_PART'] = 32; } } return $r; }],
        'wrong binding column' => ['STATISTICS', 'coaching_unique_indexes_required', static function ($r) { foreach ($r as &$i) { if ($i['INDEX_NAME'] === 'item_binding') { $i['COLUMN_NAME'] = 'order_id'; } } return $r; }],
        'column query failure' => ['COLUMNS', 'coaching_schema_unavailable', static function ($r, $f) { $f->last_error = 'simulated_metadata_failure'; return null; }],
        'index query failure' => ['STATISTICS', 'coaching_schema_unavailable', static function ($r, $f) { $f->last_error = 'simulated_metadata_failure'; return null; }],
        'table query failure' => ['TABLES', 'coaching_storage_unavailable', static function ($r, $f) { $f->last_error = 'simulated_metadata_failure'; return null; }],
        'database identity mismatch' => ['SELECT DATABASE()', 'coaching_database_mismatch', static fn($r) => 'foreign_database'],
    ];
    $readRows = static fn() => $pdo->query('SELECT * FROM `fixture_mmed_coaching_allocations` ORDER BY allocation_key')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($schemaFaults as $label => [$target, $expectedError, $fault]) {
        $before = $readRows(); $db->runtimeQueries = [];
        $db->metadataFilter = static fn($sql, $rows, $fixture) => str_contains($sql, $target) ? $fault($rows, $fixture) : $rows;
        try { $allocator->reserve(snapshot(99001)); check(false, 'schema ' . $label . ' rejected'); }
        catch (RuntimeException $e) { check($e->getMessage() === $expectedError, 'schema ' . $label . ' exact rejection'); }
        finally { $db->metadataFilter = null; }
        check($db->runtimeQueries === [], 'schema ' . $label . ' no transaction DDL or mutation');
        check($readRows() === $before && !$pdo->inTransaction(), 'schema ' . $label . ' durable rows unchanged');
    }

    // Child PHP processes create independent PDO connections; real DB row locks
    // serialize admission. No process shares a live parent PDO socket.
    $race = static function (array $ids, $modes = 'reserve') use ($pdo): array {
        $jobs = []; $start = microtime(true) + 2.0;
        foreach ($ids as $index => $id) {
            $mode = is_array($modes) ? $modes[$index] : $modes;
            $pipes = []; $process = proc_open([PHP_BINARY, __FILE__, '--race-worker', (string) $id, (string) $start, $mode], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($process)) { throw new RuntimeException('fixture_worker_unavailable'); }
            fclose($pipes[0]); $jobs[] = [$process, $pipes];
        }
        $results = [];
        foreach ($jobs as [$process, $pipes]) {
            $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
            if (proc_close($process) !== 0 || $err !== '') { throw new RuntimeException('fixture_worker_failed'); }
            $results[] = json_decode($out, true, 512, JSON_THROW_ON_ERROR);
        }
        return $results;
    };
    $results = $race(range(1001, 1032));
    check(count(array_filter($results, fn($r) => $r['ok'])) === 20, 'parallel32 admits exactly20');
    check(count(array_filter($results, fn($r) => !$r['ok'] && $r['code'] === 'cap')) === 12, 'parallel overflow denied');
    check(scalar($pdo, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE promotional=1 AND state='reserved'") === 20, 'exact20 durable reservations');
    check(scalar($pdo, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE paid_at IS NOT NULL") === 0, 'unpaid reservations not paid usage');
    $regular = $allocator->reserve(snapshot(5001, 'bacs', false));
    check($regular['promotional'] === 0 || $regular['promotional'] === '0', 'regular order does not consume promotion');
    check($regular['state'] === 'reserved', 'regular coaching allowed after cap');
    $bad = snapshot(5002, 'bacs', false); $bad['sku'] = 'bootcamp'; $bad = rehash($bad);
    rejects(fn() => $allocator->reserve($bad), 'unrelated course order rejected');

    resetRows($pdo); $results = $race(array_fill(0, 20, 6001));
    check(count(array_filter($results, fn($r) => $r['ok'])) === 20, 'parallel sameorder replay succeeds idempotently');
    check(scalar($pdo, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE order_id=6001") === 1, 'sameorder one allocation');
    check(scalar($pdo, "SELECT revision FROM `fixture_mmed_coaching_allocations` WHERE order_id=6001") === 1, 'sameorder no revision inflation');
    $s = snapshot(6001); $row = $allocator->reserve($s); $changed = $s; $changed['wp_customer_id'] = 43; $changed = rehash($changed);
    rejects(fn() => $allocator->reserve($changed), 'sameorder snapshot owner mismatch denied');
    at($pdo, FIXTURE_NOW + 100); $replay = $allocator->reserve($s);
    check((int) $replay['expires_at'] === FIXTURE_NOW + 86400, 'refresh never extends original Zelle deadline');
    at($pdo, FIXTURE_NOW + 86400); $new = $allocator->reserve(snapshot(6002, 'bacs', true, FIXTURE_NOW + 86400));
    $old = $allocator->readOwned($s);
    check($new['state'] === 'reserved' && $old['state'] === 'released', 'exact expiry releases unpaid and permits new admission');
    check($allocator->reserve($s)['state'] === 'released', 'expired replay never restores hold');
    $late = $allocator->beginSettlement($s, fingerprint(6001));
    check($late['state'] === 'review' && $late['financial_fingerprint'] === fingerprint(6001) && $late['paid_at'] === null, 'late genuine-fact SIMULATION retained for review, not paid');
    rejects(fn() => $allocator->confirmCanonicalPaid($s, fingerprint(6001), FIXTURE_NOW + 86400), 'late reviewed payment cannot activate allocation');

    resetRows($pdo); $s = snapshot(7001); $allocator->reserve($s);
    rejects(fn() => $allocator->confirmCanonicalPaid($s, fingerprint(7001), FIXTURE_NOW), 'paid assertion requires begin settlement');
    $settling = $allocator->beginSettlement($s, fingerprint(7001));
    check($settling['state'] === 'settling' && $settling['paid_at'] === null, 'settling is not paid');
    at($pdo, FIXTURE_NOW + 86401); $allocator->reserve(snapshot(7002, 'bacs', true, FIXTURE_NOW + 86401));
    check($allocator->readOwned($s)['state'] === 'settling', 'uncertain settlement does not expire/release');
    $paid = $allocator->confirmCanonicalPaid($s, fingerprint(7001), FIXTURE_NOW + 1);
    check($paid['state'] === 'paid' && (int) $paid['paid_at'] === FIXTURE_NOW + 1, 'SIMULATED canonical paid fact only after beginning');
    check($allocator->confirmCanonicalPaid($s, fingerprint(7001), FIXTURE_NOW + 1)['revision'] === $paid['revision'], 'paid replay idempotent');
    rejects(fn() => $allocator->confirmCanonicalPaid($s, fingerprint(7001), FIXTURE_NOW + 2), 'paid timestamp immutable on replay');
    $other = snapshot(7003, 'bacs', false, FIXTURE_NOW + 86401); $allocator->reserve($other);
    rejects(fn() => $allocator->beginSettlement($other, fingerprint(7001)), 'same fingerprint cannot fund another order');
    check($allocator->readOwned($other)['financial_fingerprint'] === null, 'unique fingerprint failure rolled back completely');

    resetRows($pdo);
    for ($i = 8001; $i <= 8020; ++$i) {
        $s = snapshot($i); $allocator->reserve($s); $allocator->beginSettlement($s, fingerprint($i)); $allocator->confirmCanonicalPaid($s, fingerprint($i), FIXTURE_NOW); $allocator->quarantineRefund($s);
    }
    check(scalar($pdo, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE state='revoked' AND paid_at IS NOT NULL AND financial_fingerprint IS NOT NULL") === 20, 'refund quarantine retains paid financial evidence');
    rejects(fn() => $allocator->reserve(snapshot(8021)), 'refund never refills20paid cap');
    $s = snapshot(8001); $revoked = $allocator->readOwned($s);
    check($allocator->quarantineRefund($s)['revision'] === $revoked['revision'], 'refund quarantine replay does not inflate revision');

    resetRows($pdo);
    for ($i = 8501; $i <= 8520; ++$i) { $allocator->reserve(snapshot($i)); }
    $preconfirm = snapshot(8501); $allocator->beginSettlement($preconfirm, fingerprint(8501));
    $quarantined = $allocator->quarantineRefund($preconfirm);
    check($quarantined['state'] === 'revoked' && $quarantined['paid_at'] === null && (int) $quarantined['cap_claimed'] === 1, 'refund before confirm preserves claim without inventing paid fact');
    check($quarantined['financial_fingerprint'] === fingerprint(8501), 'preconfirm refund keeps observed financial fingerprint');
    check($allocator->quarantineRefund($preconfirm)['revision'] === $quarantined['revision'], 'preconfirm refund replay idempotent');
    check($allocator->reserve($preconfirm)['state'] === 'revoked', 'reserve replay never restores quarantined allocation');
    rejects(fn() => $allocator->confirmCanonicalPaid($preconfirm, fingerprint(8501), FIXTURE_NOW), 'late confirm cannot override preconfirm refund quarantine');
    $unsettledRefund = $allocator->quarantineRefund(snapshot(8502));
    check($unsettledRefund['paid_at'] === null && $unsettledRefund['financial_fingerprint'] === null && (int) $unsettledRefund['cap_claimed'] === 1, 'pre-settlement quarantine preserves original cap claim without fabricated payment');
    check(scalar($pdo, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE promotional=1 AND cap_claimed=1") === 20, 'all20 claims occupied after refund-before-confirm');
    rejects(fn() => $allocator->reserve(snapshot(8521)), 'refund-before-confirm never refills full20 cap');

    resetRows($pdo);
    $pdo->beginTransaction(); $pdo->exec("INSERT INTO `fixture_mmed_coaching_allocations` (allocation_key,state,observed_at) VALUES ('fixture:ambient','fixture',1792400000)");
    rejects(fn() => $allocator->reserve(snapshot(9001)), 'ambient transaction rejected before allocator commit');
    check($pdo->inTransaction(), 'caller ambient transaction remains owned by caller');
    $observer = connection();
    check(scalar($observer, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE allocation_key='fixture:ambient'") === 0, 'ambient uncommitted row not exposed');
    $pdo->rollBack();
    check(scalar($observer, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE allocation_key='fixture:ambient'") === 0, 'caller rollback remains effective');
    check(scalar($observer, "SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE order_id=9001") === 0, 'ambient rejection creates no allocation');
    unset($observer);
    resetRows($pdo);
    $stripeRace = $race(range(91001, 91025), 'init');
    check(count(array_filter($stripeRace, fn($r) => $r['ok'] && $r['state'] === 'initializing')) === 20, 'Stripe25 parallel real initializations exactly20 admitted');
    check(count(array_filter($stripeRace, fn($r) => !$r['ok'] && $r['code'] === 'cap')) === 5 && scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE cap_claimed=1') === 20, 'Stripe parallel initialization cannot exceed20 claims');
    resetRows($pdo);
    $sameStripeRace = $race(array_fill(0,20,91050), 'init');
    check(count(array_filter($sameStripeRace, fn($r) => $r['ok'])) === 1 && count(array_filter($sameStripeRace, fn($r) => !$r['ok'])) === 19, 'Stripe sameorder20 parallel create admits once only');
    check(scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE cap_claimed=1') === 1, 'Stripe sameorder concurrent create keeps exactly one claim');
    resetRows($pdo);
    $stripeS = snapshot(92001, 'stripe'); $allocator->reserve($stripeS); $allocator->beginStripeInitialization($stripeS);
    rejects(fn() => $allocator->beginStripeInitialization($stripeS), 'Stripe initializing cannot create a second intent');
    $terminal = ['id'=>'pi_SIMULATED92001','status'=>'canceled','amount'=>24900,'amount_received'=>0,'currency'=>'usd','order_binding_verified'=>true];
    foreach (['initializing','processing','received','amount','binding'] as $case) {
        $badIntent = $terminal;
        if (in_array($case, ['initializing','processing'], true)) { $badIntent['status'] = $case; }
        if ($case === 'received') { $badIntent['amount_received'] = 1; }
        if ($case === 'amount') { $badIntent['amount'] = 24899; }
        if ($case === 'binding') { $badIntent['order_binding_verified'] = false; }
        rejects(fn() => $allocator->releaseCanceledStripe($stripeS, $badIntent), 'Stripe uncertain ' . $case . ' cannot release');
        check($allocator->readOwned($stripeS)['state'] === 'initializing' && (int)$allocator->readOwned($stripeS)['cap_claimed'] === 1, 'Stripe uncertain ' . $case . ' keeps claim');
    }
    $released = $allocator->releaseCanceledStripe($stripeS, $terminal);
    check($released['state'] === 'released' && (int)$released['cap_claimed'] === 0 && $released['financial_fingerprint'] === null, 'Stripe terminal canceled zero received releases unpaid');
    check($allocator->releaseCanceledStripe($stripeS, $terminal)['revision'] === $released['revision'], 'Stripe canceled release replay idempotent');
    rejects(fn() => $allocator->beginStripeInitialization($stripeS), 'Stripe released allocation cannot initialize');
    $funded = snapshot(92002, 'stripe'); $allocator->reserve($funded); $allocator->beginStripeInitialization($funded); $allocator->beginSettlement($funded, fingerprint(92002));
    $fundedTerminal = $terminal; $fundedTerminal['id'] = 'pi_SIMULATED92002';
    rejects(fn() => $allocator->releaseCanceledStripe($funded, $fundedTerminal), 'Stripe settling observed funds cannot release');
    check($allocator->readOwned($funded)['state'] === 'settling' && (int)$allocator->readOwned($funded)['cap_claimed'] === 1, 'Stripe settling keeps permanent claim');
    $contested = snapshot(92003, 'stripe'); $allocator->reserve($contested); $allocator->beginStripeInitialization($contested);
    $contestedResults = $race([92003, 92003], ['cancel', 'settle']);
    $contestedRow = $allocator->readOwned($contested);
    check(count(array_filter($contestedResults, fn($r) => $r['ok'] && $r['state'] === 'settling')) <= 1 && in_array($contestedRow['state'], ['review','settling'], true), 'Stripe cancel settlement race serializes to review or settling');
    check($contestedRow['financial_fingerprint'] === fingerprint(92003) && $contestedRow['paid_at'] === null && (int)$contestedRow['cap_claimed'] === ($contestedRow['state'] === 'settling' ? 1 : 0), 'Stripe cancel settlement race no fabricated paid or duplicate claim');
    $createContested = snapshot(92004, 'stripe'); $allocator->reserve($createContested); $allocator->beginStripeInitialization($createContested);
    $createCancelRace = $race([92004,92004], ['cancel','init']);
    $createContestedRow = $allocator->readOwned($createContested);
    check($createCancelRace[0]['ok'] && !$createCancelRace[1]['ok'] && $createContestedRow['state'] === 'released' && (int)$createContestedRow['cap_claimed'] === 0, 'Stripe old-intent cancel racing new create always denies new create');
    $allocatorAssertions = $count;
    require __DIR__ . '/mr-coaching-woo-hybrid-lifecycle.spec.php';
    echo json_encode(['ok' => true, 'assertions' => $count, 'allocator_assertions'=>$allocatorAssertions, 'hybrid_assertions'=>$count-$allocatorAssertions, 'engine' => 'isolated MariaDB11.4', 'synthetic_financial_facts_only' => true, 'hybrid_module_sha256' => $hybridModuleSha, 'allocator_sha256'=>$testedAllocatorSha, 'stripe_lifecycle_sha256'=>$stripeLifecycleSha]) . "\n";
} catch (Throwable $e) {
    // Never print DSNs, generated credentials, SQL, snapshots or driver errors.
    $label = str_starts_with($e->getMessage(), 'assertion:') ? $e->getMessage() : 'isolated_allocator_test_failed';
    fwrite(STDERR, json_encode(['ok' => false, 'assertions' => $count, 'error' => $label]) . "\n"); exit(1);
}
