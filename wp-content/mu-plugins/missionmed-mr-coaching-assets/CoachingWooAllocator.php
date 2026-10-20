<?php
declare(strict_types=1);

/** DR-516 new-table-only allocator. Never marks a Woo order paid, issues a
 * refund, creates an entitlement or calls a financial provider. All arguments
 * must be derived by the owning Woo module from current canonical order data.
 */
final class CoachingWooAllocator
{
    private string $table;
    private string $database;
    private const CUTOFF = 1793505600;
    private const PRICES = ['single' => [39900,24900], 'three' => [109900,74900], 'five' => [179900,119900]];

    public function __construct(private object $db)
    {
        if (!is_string($db->prefix ?? null) || !preg_match('/^[A-Za-z0-9_]+$/D', $db->prefix)) {
            throw new DomainException('coaching_storage_identity_unavailable');
        }
        $this->table = $db->prefix . 'mmed_coaching_allocations';
        if (!defined('DB_NAME') || !is_string(DB_NAME) || DB_NAME === '') {
            throw new DomainException('coaching_database_custody_required');
        }
        $this->database = DB_NAME;
    }

    /** DDL is returned for separately reviewed/fenced installation, never run
     * during checkout, a page load or constructor. No ALTER of existing tables.
     */
    public function installationSql(): array
    {
        return ["CREATE TABLE `{$this->table}` (
            allocation_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
            order_id BIGINT UNSIGNED NULL, order_item_id BIGINT UNSIGNED NULL,
            owner_wp_user_id BIGINT UNSIGNED NULL,
            snapshot_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
            snapshot_json LONGTEXT NULL, sku VARCHAR(16) NULL, gateway VARCHAR(8) NULL,
            promotional TINYINT UNSIGNED NOT NULL DEFAULT 0,
            cap_claimed TINYINT UNSIGNED NOT NULL DEFAULT 0,
            state VARCHAR(16) NOT NULL, original_created_at BIGINT UNSIGNED NULL,
            expires_at BIGINT UNSIGNED NULL, paid_at BIGINT UNSIGNED NULL,
            financial_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
            revision BIGINT UNSIGNED NOT NULL DEFAULT 1, observed_at BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (allocation_key), UNIQUE KEY order_binding (order_id),
            UNIQUE KEY item_binding (order_item_id), UNIQUE KEY payment_binding (financial_fingerprint),
            KEY promotion_state (promotional,cap_claimed)
        ) ENGINE=InnoDB DEFAULT CHARACTER SET ascii COLLATE ascii_bin", "INSERT INTO `{$this->table}` (allocation_key,state,observed_at) VALUES ('campaign:MATCHREADY2026','campaign',UNIX_TIMESTAMP())"];
    }

    private function query(string $sql): int
    {
        $result = $this->db->query($sql);
        if ($result === false) { throw new RuntimeException('coaching_storage_unavailable'); }
        return (int) $result;
    }

    private function one(string $sql): ?array
    {
        $this->db->last_error = '';
        $row = $this->db->get_row($sql, 'ARRAY_A');
        if ($this->db->last_error !== '' || ($row !== null && !is_array($row))) { throw new RuntimeException('coaching_storage_unavailable'); }
        return $row;
    }

    private function many(string $sql): array
    {
        $this->db->last_error = '';
        $rows = $this->db->get_results($sql, 'ARRAY_A');
        if ($this->db->last_error !== '' || !is_array($rows)) { throw new RuntimeException('coaching_schema_unavailable'); }
        return $rows;
    }

    /** Exact read-only manifest; never repair/migrate a schema at runtime. */
    public function assertSchema(): void
    {
        if ($this->db->get_var('SELECT DATABASE()') !== $this->database) { throw new RuntimeException('coaching_database_mismatch'); }
        $where = $this->db->prepare('TABLE_SCHEMA=%s AND TABLE_NAME=%s', $this->database, $this->table);
        $table = $this->one('SELECT ENGINE,TABLE_TYPE,TABLE_COLLATION FROM information_schema.TABLES WHERE ' . $where);
        if (!$table || $table['ENGINE'] !== 'InnoDB' || $table['TABLE_TYPE'] !== 'BASE TABLE' || $table['TABLE_COLLATION'] !== 'ascii_bin') {
            throw new RuntimeException('coaching_transactional_schema_required');
        }
        $types = ['allocation_key'=>'varchar(96)','schema_version'=>'smallint unsigned','order_id'=>'bigint unsigned',
            'order_item_id'=>'bigint unsigned','owner_wp_user_id'=>'bigint unsigned','snapshot_digest'=>'char(64)',
            'snapshot_json'=>'longtext','sku'=>'varchar(16)','gateway'=>'varchar(8)','promotional'=>'tinyint unsigned',
            'cap_claimed'=>'tinyint unsigned','state'=>'varchar(16)','original_created_at'=>'bigint unsigned',
            'expires_at'=>'bigint unsigned','paid_at'=>'bigint unsigned','financial_fingerprint'=>'char(64)',
            'revision'=>'bigint unsigned','observed_at'=>'bigint unsigned'];
        $notNull = ['allocation_key','schema_version','promotional','cap_claimed','state','revision','observed_at'];
        $columns = $this->many('SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLLATION_NAME,EXTRA FROM information_schema.COLUMNS WHERE ' . $where . ' ORDER BY ORDINAL_POSITION');
        if (count($columns) !== count($types)) { throw new RuntimeException('coaching_columns_mismatch'); }
        foreach ($columns as $column) {
            $name = $column['COLUMN_NAME'];
            $type = strtolower($column['COLUMN_TYPE']);
            $type = preg_replace('/^(tinyint|smallint|bigint)\([0-9]+\)/', '$1', $type);
            $text = str_starts_with($type,'varchar') || str_starts_with($type,'char') || $type === 'longtext';
            if (!isset($types[$name]) || $types[$name] !== $type || $column['EXTRA'] !== ''
                || $column['IS_NULLABLE'] !== (in_array($name,$notNull,true) ? 'NO' : 'YES')
                || $column['COLLATION_NAME'] !== ($text ? 'ascii_bin' : null)) { throw new RuntimeException('coaching_columns_mismatch'); }
            unset($types[$name]);
        }
        $expected = ['PRIMARY'=>[0,['allocation_key']], 'order_binding'=>[0,['order_id']], 'item_binding'=>[0,['order_item_id']],
            'payment_binding'=>[0,['financial_fingerprint']], 'promotion_state'=>[1,['promotional','cap_claimed']]];
        $indexes = [];
        foreach ($this->many('SELECT INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART,INDEX_TYPE FROM information_schema.STATISTICS WHERE ' . $where . ' ORDER BY INDEX_NAME,SEQ_IN_INDEX') as $index) {
            $name = $index['INDEX_NAME'];
            if (!isset($expected[$name]) || (int)$index['NON_UNIQUE'] !== $expected[$name][0]
                || $index['SUB_PART'] !== null || $index['INDEX_TYPE'] !== 'BTREE'
                || (int)$index['SEQ_IN_INDEX'] !== count($indexes[$name] ?? [])+1) { throw new RuntimeException('coaching_unique_indexes_required'); }
            $indexes[$name][] = $index['COLUMN_NAME'];
        }
        if (count($indexes) !== count($expected)) { throw new RuntimeException('coaching_unique_indexes_required'); }
        foreach ($expected as $name=>$spec) { if (($indexes[$name] ?? null) !== $spec[1]) { throw new RuntimeException('coaching_unique_indexes_required'); } }
    }

    private function transaction(callable $work)
    {
        // SET TRANSACTION fails if an ambient transaction is already active;
        // do not silently START/commit a transaction owned by another plugin.
        if ((string) $this->db->get_var('SELECT @@session.autocommit') !== '1') { throw new RuntimeException('coaching_ambient_transaction_forbidden'); }
        $this->assertSchema();
        $this->query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        $this->query('START TRANSACTION');
        try {
            $campaign = $this->one("SELECT * FROM `{$this->table}` WHERE allocation_key='campaign:MATCHREADY2026' FOR UPDATE");
            if (!$campaign || (int) $campaign['schema_version'] !== 1 || $campaign['state'] !== 'campaign') {
                throw new RuntimeException('coaching_schema_not_admitted');
            }
            $now = $this->db->get_var('SELECT UNIX_TIMESTAMP()');
            if (!is_numeric($now) || (int) $now < 1792368000) { throw new RuntimeException('coaching_server_time_unavailable'); }
            $result = $work((int) $now);
            $this->query('COMMIT');
            return $result;
        } catch (Throwable $e) {
            $this->db->query('ROLLBACK');
            throw $e;
        }
    }

    private function validate(array $s): void
    {
        $keys = ['order_id','order_item_id','wp_customer_id','product_id','sku','gateway','quantity','currency',
            'tuition_cents','total_cents','fee_cents','tax_cents','coupon','order_created_at','snapshot_digest'];
        if (array_keys($s) !== $keys || !is_string($s['snapshot_digest']) || !preg_match('/^[a-f0-9]{64}$/D',$s['snapshot_digest'])) {
            throw new DomainException('coaching_exact_snapshot_required');
        }
        $body=$s; unset($body['snapshot_digest']);
        if (!hash_equals($s['snapshot_digest'], hash('sha256',json_encode($body, JSON_THROW_ON_ERROR)))) { throw new DomainException('coaching_snapshot_hash_mismatch'); }
        foreach (['order_id','order_item_id'] as $k) {
            if (!is_string($s[$k]) || !preg_match('/^[1-9][0-9]{0,14}$/D',$s[$k])) { throw new DomainException('coaching_order_identity_required'); }
        }
        foreach (['wp_customer_id','product_id','tuition_cents','total_cents','fee_cents','tax_cents'] as $k) {
            if (!is_int($s[$k]) || $s[$k] < 0) { throw new DomainException('coaching_integer_amount_identity_required'); }
        }
        $price=self::PRICES[$s['sku']] ?? null;
        if (!$price || $s['wp_customer_id'] <= 0 || $s['product_id'] <= 0 || $s['quantity'] !== 1 || $s['currency'] !== 'USD'
            || !in_array($s['gateway'],['stripe','bacs'],true) || !in_array($s['coupon'],['','MATCHREADY2026'],true)
            || $s['tuition_cents'] !== $price[$s['coupon'] === '' ? 0 : 1]
            || $s['total_cents'] !== $s['tuition_cents']+$s['fee_cents']+$s['tax_cents']) { throw new DomainException('coaching_commercial_snapshot_invalid'); }
        $d=DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z',$s['order_created_at'],new DateTimeZone('UTC'));
        if (!$d || $d->format('Y-m-d\TH:i:s\Z') !== $s['order_created_at']) { throw new DomainException('coaching_original_created_at_required'); }
    }

    private function row(array $s): ?array
    {
        $row=$this->one($this->db->prepare("SELECT * FROM `{$this->table}` WHERE order_id=%d FOR UPDATE",(int)$s['order_id']));
        if ($row && ($row['snapshot_digest'] !== $s['snapshot_digest']
            || $row['snapshot_json'] !== json_encode($s,JSON_THROW_ON_ERROR))) { throw new DomainException('coaching_immutable_order_replay_mismatch'); }
        return $row;
    }

    public function reserve(array $s): array
    {
        $this->validate($s);
        return $this->transaction(function(int $now) use($s) {
            $this->query($this->db->prepare("UPDATE `{$this->table}` SET state='released',cap_claimed=0,revision=revision+1,observed_at=%d WHERE state='reserved' AND gateway='bacs' AND paid_at IS NULL AND financial_fingerprint IS NULL AND expires_at<=%d",$now,$now));
            $row=$this->row($s);
            if ($row) { return $row; } // Immutable deadline; never renew/revive.
            $created=(new DateTimeImmutable($s['order_created_at']))->getTimestamp();
            if ($created > $now || ($s['gateway']==='bacs' && $now >= $created+86400)) { throw new DomainException('coaching_reservation_expired'); }
            $promo=$s['coupon']==='MATCHREADY2026';
            if ($promo) {
                $count=$this->one("SELECT COUNT(*) AS occupied FROM `{$this->table}` WHERE promotional=1 AND cap_claimed=1");
                if (!$count || !ctype_digit((string)$count['occupied']) || $now>=self::CUTOFF || (int)$count['occupied']>=20) { throw new DomainException('coaching_promotion_unavailable'); }
            }
            $expires=$s['gateway']==='bacs' ? $created+86400 : null;
            $deadline=$expires===null?'NULL':(string)$expires;
            $sql=$this->db->prepare("INSERT INTO `{$this->table}` (allocation_key,order_id,order_item_id,owner_wp_user_id,snapshot_digest,snapshot_json,sku,gateway,promotional,cap_claimed,state,original_created_at,expires_at,observed_at) VALUES (%s,%d,%d,%d,%s,%s,%s,%s,%d,%d,'reserved',%d,{$deadline},%d)",
                'order:'.$s['order_id'],(int)$s['order_id'],(int)$s['order_item_id'],$s['wp_customer_id'],$s['snapshot_digest'],json_encode($s,JSON_THROW_ON_ERROR),$s['sku'],$s['gateway'],$promo?1:0,$promo?1:0,$created,$now);
            $this->query($sql);
            return $this->row($s);
        });
    }

    /** Serialize admission immediately before the existing gateway creates or
     * confirms an intent. No intent/no initialization means no Stripe hold.
     * An interrupted provider request remains uncertain, never timer-released.
     */
    public function beginStripeInitialization(array $s): array
    {
        $this->validate($s);
        if ($s['gateway'] !== 'stripe') { throw new DomainException('coaching_stripe_required'); }
        return $this->transaction(function(int $now) use($s) {
            $row=$this->row($s);
            if (!$row || $row['state']!=='reserved'
                || $row['paid_at']!==null || $row['financial_fingerprint']!==null) { throw new DomainException('coaching_stripe_initialization_denied'); }
            if ($row['state']==='reserved') {
                $this->query($this->db->prepare("UPDATE `{$this->table}` SET state='initializing',revision=revision+1,observed_at=%d WHERE order_id=%d AND state='reserved' AND revision=%d",$now,(int)$s['order_id'],(int)$row['revision']));
            }
            return $this->row($s);
        });
    }

    /** Server-only caller must authenticate provider evidence and order-key
     * ownership before passing this terminal fact. No financial receipt is
     * manufactured for an intent which received zero funds.
     */
    public function releaseCanceledStripe(array $s,array $intent): array
    {
        $this->validate($s);
        if ($s['gateway']!=='stripe' || array_keys($intent)!==['id','status','amount','amount_received','currency','order_binding_verified']
            || !is_string($intent['id']) || !preg_match('/^pi_[A-Za-z0-9]+$/D',$intent['id'])
            || $intent['status']!=='canceled' || $intent['amount']!==$s['total_cents'] || $intent['amount_received']!==0
            || $intent['currency']!=='usd' || $intent['order_binding_verified']!==true) { throw new DomainException('coaching_terminal_unpaid_stripe_required'); }
        return $this->transaction(function(int $now) use($s) {
            $row=$this->row($s);
            if (!$row || !in_array($row['state'],['reserved','initializing','released'],true)
                || $row['paid_at']!==null || $row['financial_fingerprint']!==null) { throw new DomainException('coaching_uncertain_stripe_release_forbidden'); }
            if ($row['state']!=='released') {
                $this->query($this->db->prepare("UPDATE `{$this->table}` SET state='released',cap_claimed=0,revision=revision+1,observed_at=%d WHERE order_id=%d AND revision=%d",$now,(int)$s['order_id'],(int)$row['revision']));
            }
            return $this->row($s);
        });
    }

    /** Existing trusted gateway/verifier has entered canonical completion.
     * 'settling' is NOT paid. It holds capacity across crashes/uncertainty.
     */
    public function beginSettlement(array $s,string $fingerprint): array
    {
        $this->validate($s); self::fingerprint($fingerprint);
        return $this->transaction(function(int $now) use($s,$fingerprint) {
            $row=$this->row($s);
            if (!$row) { throw new DomainException('coaching_admission_required'); }
            if ($row['financial_fingerprint']!==null && $row['financial_fingerprint']!==$fingerprint) { throw new DomainException('coaching_payment_replay_mismatch'); }
            if (in_array($row['state'],['paid','settling'],true)) { return $row; }
            $admitted=$s['gateway']==='stripe' ? $row['state']==='initializing' : $row['state']==='reserved' && $now<(int)$row['expires_at'];
            $state=$admitted ? 'settling' : 'review';
            $this->query($this->db->prepare("UPDATE `{$this->table}` SET state=%s,financial_fingerprint=%s,revision=revision+1,observed_at=%d WHERE order_id=%d AND revision=%d",
                $state,$fingerprint,$now,(int)$s['order_id'],(int)$row['revision']));
            return $this->row($s);
        });
    }

    /** Called ONLY after the module independently rechecks genuine canonical
     * paid Woo evidence. This records that fact; it never creates the fact.
     */
    public function confirmCanonicalPaid(array $s,string $fingerprint,int $canonicalPaidAt): array
    {
        $this->validate($s); self::fingerprint($fingerprint);
        return $this->transaction(function(int $now) use($s,$fingerprint,$canonicalPaidAt) {
            $row=$this->row($s);
            if (!$row || $row['financial_fingerprint']!==$fingerprint || !in_array($row['state'],['settling','paid'],true)
                || $canonicalPaidAt<(int)$row['original_created_at'] || $canonicalPaidAt>$now) { throw new DomainException('coaching_canonical_paid_binding_required'); }
            if ($row['state']==='paid') {
                if ((int)$row['paid_at']!==$canonicalPaidAt) { throw new DomainException('coaching_paid_timestamp_replay_mismatch'); }
                return $row;
            }
            $this->query($this->db->prepare("UPDATE `{$this->table}` SET state='paid',paid_at=%d,revision=revision+1,observed_at=%d WHERE order_id=%d AND state='settling' AND revision=%d",
                $canonicalPaidAt,$now,(int)$s['order_id'],(int)$row['revision']));
            return $this->row($s);
        });
    }

    public function quarantineRefund(array $s): array
    {
        $this->validate($s);
        return $this->transaction(function(int $now) use($s) {
            $row=$this->row($s); if (!$row) { throw new DomainException('coaching_order_binding_required'); }
            if ($row['state']!=='revoked') { $this->query($this->db->prepare("UPDATE `{$this->table}` SET state='revoked',revision=revision+1,observed_at=%d WHERE order_id=%d AND revision=%d",$now,(int)$s['order_id'],(int)$row['revision'])); }
            // Keep the original cap claim even if the canonical refund races
            // before paid confirmation. This is unresolved occupancy, not an
            // invented paid redemption. Never replenish on a refund callback.
            // paid_at/fingerprint remain permanent; no automatic cap refill.
            return $this->row($s);
        });
    }

    public function readOwned(array $s): ?array
    {
        $this->validate($s);
        // Consistent lock and schema verification; no state or rights mutation.
        return $this->transaction(fn(int $now) => $this->row($s));
    }

    private static function fingerprint(string $v): void
    {
        if (!preg_match('/^[a-f0-9]{64}$/D',$v)) { throw new DomainException('coaching_financial_binding_required'); }
    }
}
