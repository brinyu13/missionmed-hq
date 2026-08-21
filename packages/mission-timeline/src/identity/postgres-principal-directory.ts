import { randomUUID } from "node:crypto";

import type { FacultyGrant, Role, TimelineAction } from "../contracts/types.js";
import type { PostgresPool, PostgresTransactionClient } from "../persistence/postgres/types.js";
import type { TimelinePrincipalDirectory, TimelinePrincipalRecord } from "./wordpress-timeline-jwt.js";

interface PrincipalRow {
  id: string;
  wp_user_id: string | number;
  role: Role;
  status: string;
}

interface TextRow { value: string }

interface GrantRow {
  document_id: string;
  actions: string[];
  expires_at: string | Date;
}

const ACTIONS = new Set<TimelineAction>([
  "document:read", "document:edit", "version:create", "review:request", "review:read",
  "review:comment", "review:decide", "artifact:create", "artifact:read", "audit:read",
]);

export class PostgresTimelinePrincipalDirectory implements TimelinePrincipalDirectory {
  constructor(
    private readonly pool: PostgresPool,
    private readonly runtimeRole = "timeline_authenticated",
    private readonly identitySyncRole = "timeline_identity_sync",
  ) {
    if (!/^[a-z_][a-z0-9_]*$/.test(runtimeRole)) throw new TypeError("TIMELINE_RUNTIME_ROLE_INVALID");
    if (!/^[a-z_][a-z0-9_]*$/.test(identitySyncRole)) throw new TypeError("TIMELINE_IDENTITY_SYNC_ROLE_INVALID");
  }

  async resolve(
    principalId: string,
    wpUserId: number,
    role: Role,
    eligibility: { isWordpressAdministrator: boolean; hasLearndash3893Access: boolean },
    at: string,
  ): Promise<TimelinePrincipalRecord | null> {
    const client = await this.pool.connect();
    let started = false;
    try {
      await client.query("BEGIN");
      started = true;
      const claims = JSON.stringify({
        sub: principalId,
        wp_user_id: wpUserId,
        timeline_role: role,
        is_wordpress_administrator: eligibility.isWordpressAdministrator,
        has_learndash_3893_access: eligibility.hasLearndash3893Access,
        program_ids: [],
        service_scopes: [],
      });
      await client.query(`SET LOCAL ROLE ${this.runtimeRole}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
      let resolved = await this.read(client, principalId, wpUserId, at);
      if (!resolved) {
        await client.query(`SET LOCAL ROLE ${this.identitySyncRole}`);
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
        const provisioned = await this.provision(client, principalId, wpUserId, role, eligibility, at);
        if (provisioned) {
          await client.query(`SET LOCAL ROLE ${this.runtimeRole}`);
          await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
          resolved = await this.read(client, principalId, wpUserId, at);
        }
      }
      await client.query("COMMIT");
      started = false;
      return resolved;
    } catch (error) {
      if (started) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async provision(
    database: PostgresTransactionClient,
    principalId: string,
    wpUserId: number,
    role: Role,
    eligibility: { isWordpressAdministrator: boolean; hasLearndash3893Access: boolean },
    at: string,
  ): Promise<boolean> {
    await database.query("select pg_advisory_xact_lock(hashtext($1))", [`missionmed:timeline:principal:${wpUserId}`]);
    const existing = await database.query<PrincipalRow>(
      `select id, wp_user_id, role, status
       from timeline.principals
       where id = $1 or wp_user_id = $2
       order by id`,
      [principalId, wpUserId],
    );
    if (existing.rows.length > 0) {
      return existing.rows.some((row) =>
        row.id === principalId
        && Number(row.wp_user_id) === wpUserId
        && row.role === role
        && row.status === "ACTIVE"
      );
    }
    const eligible = role === "PROGRAM_ADMIN"
      ? eligibility.isWordpressAdministrator
      : role === "STUDENT" && eligibility.hasLearndash3893Access;
    if (!eligible) return false;
    await database.query(
      `insert into timeline.principals (id, matrix_wp_user_id, wp_user_id, role, status)
       values ($1, $2, $2, $3, 'ACTIVE')`,
      [principalId, wpUserId, role],
    );
    if (role === "STUDENT") {
      const membership = await database.query<TextRow>(
        `select program_id as value
         from timeline.principal_programs
         where principal_id = $1 and program_id = $2`,
        [principalId, "missionmed-360:3893"],
      );
      if (membership.rows.length === 0) {
        await database.query(
          `insert into timeline.principal_programs (principal_id, program_id)
           values ($1, $2)`,
          [principalId, "missionmed-360:3893"],
        );
      }
    }
    await database.query(
      `insert into timeline.audit_events
        (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
       values ($1, $2, 'PRINCIPAL_PROVISIONED_FIRST_USE', 'PRINCIPAL', $2, 'SUCCESS', $3, $4::jsonb)`,
      [
        `audit_${randomUUID()}`,
        principalId,
        `identity_first_use_${randomUUID()}`,
        JSON.stringify({ wp_user_id: wpUserId, role, course_id: 3893, verified_at: at }),
      ],
    );
    return true;
  }

  private async read(database: PostgresTransactionClient, principalId: string, wpUserId: number, at: string): Promise<TimelinePrincipalRecord | null> {
    const principalResult = await database.query<PrincipalRow>(
      `select id, wp_user_id, role, status
       from timeline.principals
       where id = $1 and wp_user_id = $2`,
      [principalId, wpUserId],
    );
    const row = principalResult.rows[0];
    if (!row) return null;

    // A checked-out pg Client supports one query at a time. Keep these reads
    // sequential so first-use identity resolution remains compatible with pg 9.
    const programResult = await database.query<TextRow>(
      `select program_id as value from timeline.principal_programs where principal_id = $1 order by program_id`,
      [principalId],
    );
    const assignmentResult = await database.query<TextRow>(
      `select distinct document_id as value
       from timeline.advisor_assignments
       where advisor_principal_id = $1
         and starts_at <= $2::timestamptz
         and (ends_at is null or ends_at > $2::timestamptz)
       order by document_id`,
      [principalId, at],
    );
    const grantResult = await database.query<GrantRow>(
      `select document_id, actions, expires_at
       from timeline.admin_resource_grants
       where administrator_principal_id = $1
         and starts_at <= $2::timestamptz
         and expires_at > $2::timestamptz
         and revoked_at is null
       order by document_id, expires_at`,
      [principalId, at],
    );

    const resourceGrants: FacultyGrant[] = grantResult.rows.map((grant) => ({
      documentId: grant.document_id,
      actions: grant.actions.filter((action): action is TimelineAction => ACTIONS.has(action as TimelineAction)),
      expiresAt: new Date(grant.expires_at).toISOString(),
    }));
    return {
      principalId: row.id,
      wpUserId: Number(row.wp_user_id),
      role: row.role,
      active: row.status === "ACTIVE",
      programIds: programResult.rows.map((item) => item.value),
      assignedDocumentIds: assignmentResult.rows.map((item) => item.value),
      resourceGrants,
    };
  }
}
