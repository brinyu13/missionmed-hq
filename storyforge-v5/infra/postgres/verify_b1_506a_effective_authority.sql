\set ON_ERROR_STOP on

DO $b1_506a_effective_authority$
DECLARE
  effective_authority_count integer;
  effective_authority_sha256 text;
BEGIN
  PERFORM pg_catalog.set_config(
    'search_path',
    'pg_catalog, public',
    true
  );
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname = 'authenticated'
        AND NOT rolcanlogin
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolreplication
        AND NOT rolbypassrls
        AND NOT rolinherit
        AND rolconnlimit = -1
        AND rolvaliduntil IS NULL
        AND coalesce(cardinality(rolconfig), 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'B1-506 authenticated role is not exact least privilege';
  END IF;

  WITH effective_authority(entry) AS (
    SELECT format('DATABASE|CURRENT_DATABASE|%s|%s|%s',
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_database database_item
      CROSS JOIN LATERAL aclexplode(
        coalesce(database_item.datacl, acldefault('d', database_item.datdba))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE database_item.datname = current_database()
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('SCHEMA|%s|%s|%s|%s', namespace.nspname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_namespace namespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('RELATION|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(
          relation.relacl,
          acldefault(
            CASE
              WHEN relation.relkind = 'S' THEN 'S'::"char"
              ELSE 'r'::"char"
            END,
            relation.relowner
          )
        )
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('COLUMN|%s|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname, attribute.attname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_attribute attribute
      JOIN pg_class relation ON relation.oid = attribute.attrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN LATERAL aclexplode(attribute.attacl) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND attribute.attnum > 0
       AND NOT attribute.attisdropped
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('ROUTINE|%s|%s(%s)|%s|%s|%s',
                  namespace.nspname, routine.proname,
                  oidvectortypes(routine.proargtypes),
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(routine.proacl, acldefault('f', routine.proowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('TYPE|%s|%s|%s|%s|%s',
                  namespace.nspname, type_item.typname,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_type type_item
      JOIN pg_namespace namespace ON namespace.oid = type_item.typnamespace
      CROSS JOIN LATERAL aclexplode(
        coalesce(type_item.typacl, acldefault('T', type_item.typowner))
      ) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('DEFAULT|%s|%s|%s|%s|%s|%s',
                  owner_role.rolname, coalesce(namespace.nspname, '*'),
                  default_acl.defaclobjtype,
                  coalesce(grantee.rolname, 'PUBLIC'),
                  acl.privilege_type, acl.is_grantable)
      FROM pg_default_acl default_acl
      JOIN pg_roles owner_role ON owner_role.oid = default_acl.defaclrole
      LEFT JOIN pg_namespace namespace
        ON namespace.oid = default_acl.defaclnamespace
      CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl
      LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
     WHERE acl.grantee IN (0, 'authenticated'::regrole::oid)
    UNION ALL
    SELECT format('POLICY|%s|%s|%s|%s|%s|%s|%s|%s',
                  namespace.nspname, relation.relname, policy.polname,
                  policy.polcmd::text, policy.polpermissive::text,
                  array_to_string(
                    ARRAY(
                      SELECT CASE
                               WHEN policy_role = 0 THEN 'PUBLIC'
                               ELSE policy_role::regrole::text
                             END
                        FROM unnest(policy.polroles) policy_role
                       ORDER BY 1
                    ),
                    ','
                  ),
                  coalesce(pg_get_expr(policy.polqual, policy.polrelid), ''),
                  coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), ''))
      FROM pg_policy policy
      JOIN pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND (
         0::oid = ANY (policy.polroles)
         OR 'authenticated'::regrole::oid = ANY (policy.polroles)
       )
    UNION ALL
    SELECT format(
             'ROLE|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
             role_item.rolname,
             role_item.rolsuper,
             role_item.rolinherit,
             role_item.rolcreaterole,
             role_item.rolcreatedb,
             role_item.rolcanlogin,
             role_item.rolreplication,
             role_item.rolbypassrls,
             role_item.rolconnlimit,
             coalesce(role_item.rolvaliduntil::text, ''),
             coalesce(array_to_string(role_item.rolconfig, ','), ''),
             EXISTS (
               SELECT 1
                 FROM pg_authid auth_item
                WHERE auth_item.oid = role_item.oid
                  AND auth_item.rolpassword IS NOT NULL
             )
           )
      FROM pg_roles role_item
     WHERE role_item.rolname = 'authenticated'
    UNION ALL
    SELECT format(
             'MEMBERSHIP|%s|%s|%s|%s|%s',
             granted.rolname,
             member_role.rolname,
             membership.admin_option,
             membership.inherit_option,
             membership.set_option
           )
      FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_roles member_role ON member_role.oid = membership.member
     WHERE membership.member = 'authenticated'::regrole
        OR membership.roleid = 'authenticated'::regrole
    UNION ALL
    SELECT format(
             'ROW_SECURITY|%s|%s|%s|%s',
             namespace.nspname,
             relation.relname,
             relation.relrowsecurity,
             relation.relforcerowsecurity
           )
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname !~ '^pg_'
       AND namespace.nspname <> 'information_schema'
       AND relation.relkind IN ('r', 'p')
       AND (relation.relrowsecurity OR relation.relforcerowsecurity)
    UNION ALL
    SELECT format('OWNERSHIP|DATABASE|%s', database_item.datname)
      FROM pg_database database_item
     WHERE database_item.datdba = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|SCHEMA|%s', namespace.nspname)
      FROM pg_namespace namespace
     WHERE namespace.nspowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|RELATION|%s|%s',
                  namespace.nspname, relation.relname)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE relation.relowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|ROUTINE|%s|%s(%s)',
                  namespace.nspname, routine.proname,
                  oidvectortypes(routine.proargtypes))
      FROM pg_proc routine
      JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
     WHERE routine.proowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('OWNERSHIP|TYPE|%s|%s',
                  namespace.nspname, type_item.typname)
      FROM pg_type type_item
      JOIN pg_namespace namespace ON namespace.oid = type_item.typnamespace
     WHERE type_item.typowner = 'authenticated'::regrole
    UNION ALL
    SELECT format('ROLE_SETTING|%s|%s|%s',
                  CASE
                    WHEN setting.setrole = 0 THEN 'PUBLIC'
                    ELSE 'authenticated'
                  END,
                  coalesce(database_item.datname, '*'),
                  setting.setconfig::text)
      FROM pg_db_role_setting setting
      LEFT JOIN pg_database database_item
        ON database_item.oid = setting.setdatabase
     WHERE setting.setrole IN (0, 'authenticated'::regrole::oid)
  )
  SELECT count(*),
         pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to(
               pg_catalog.string_agg(entry, E'\n' ORDER BY entry COLLATE "C"),
               'UTF8'
             )
           ),
           'hex'
         )
    INTO effective_authority_count, effective_authority_sha256
    FROM effective_authority;

  IF effective_authority_count <> 244
     OR effective_authority_sha256
        <> '3b412d5773c7f757da09d57d68f76e9d1d5b25705eeb09e6030b8044d265f1f6' THEN
    RAISE EXCEPTION 'B1-506 effective authenticated/PUBLIC authority closure is not exact';
  END IF;
END
$b1_506a_effective_authority$;

SELECT 'B1_506A_EFFECTIVE_AUTHORITY_PASS' AS result;
