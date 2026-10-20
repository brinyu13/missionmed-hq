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
    $rootPdo=connection(false); $rootPdo->exec('CREATE DATABASE `fixture_coaching` CHARACTER SET utf8mb4'); unset($rootPdo);
    $pdo=connection(); $db=new WpdbPdoFixture($pdo); $allocator=new CoachingWooAllocator($db);
    foreach ($allocator->installationSql() as $sql) { $pdo->exec($sql); }
    at($pdo,FIXTURE_NOW); $allocator->assertSchema();
    require __DIR__ . '/mr-coaching-woo-refund-fixtures.php';
    echo json_encode(['ok'=>true,'assertions'=>$count,'synthetic_financial_facts_only'=>true,'engine'=>'isolated MariaDB11.4','module_sha256'=>$refundModuleSha]) . "\n";
} catch (Throwable $e) {
    $label=str_starts_with($e->getMessage(),'assertion:') ? $e->getMessage() : 'isolated_refund_test_failed';
    fwrite(STDERR,json_encode(['ok'=>false,'assertions'=>$count,'error'=>$label]) . "\n"); exit(1);
}
