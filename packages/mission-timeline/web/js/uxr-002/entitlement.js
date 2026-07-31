export const TIMELINE_ENTITLEMENT_SCHEMA="d1-405.timeline-entitlement.1";
export const TIMELINE_ENTITLEMENT_PERMISSION="timeline.access";
export const UNLIMITED_TIMELINES="unlimited";

export const ENTITLEMENT_ACCESS=Object.freeze({
  FULL:"FULL",
  READ_ONLY:"READ_ONLY",
  DENIED:"DENIED"
});

const LOCAL_SCENARIOS=new Set([
  "administrator",
  "eligible-360",
  "ineligible",
  "zero",
  "one",
  "unlimited",
  "removed",
  "override"
]);

function clone(value){
  return value==null?value:structuredClone(value);
}

function clean(value){
  return String(value||"").trim();
}

function normalizedSet(values){
  return new Set((values||[]).map((value)=>clean(value).toLowerCase()).filter(Boolean));
}

function normalizeAllowance(value,fallback=0){
  if(value===UNLIMITED_TIMELINES)return UNLIMITED_TIMELINES;
  const numeric=Number(value);
  return Number.isSafeInteger(numeric)&&numeric>=0?numeric:fallback;
}

function normalizeUsage(value){
  const numeric=Number(value);
  return Number.isSafeInteger(numeric)&&numeric>=0?numeric:null;
}

function normalizedRecord(record){
  return Object.fromEntries(
    Object.entries(record||{}).map(([key,value])=>[
      clean(key).toLowerCase(),
      clone(value)
    ])
  );
}

function ruleValue(value,defaultAllowance=0){
  if(value&&typeof value==="object"){
    return{
      enabled:value.enabled!==false,
      allowance:normalizeAllowance(value.allowance,defaultAllowance),
      reason:clean(value.reason),
      validFrom:clean(value.validFrom),
      expiresAt:clean(value.expiresAt)
    };
  }
  return{
    enabled:true,
    allowance:normalizeAllowance(value,defaultAllowance),
    reason:"",
    validFrom:"",
    expiresAt:""
  };
}

function ruleActive(rule,now=new Date()){
  const validFrom=rule.validFrom?Date.parse(rule.validFrom):null;
  const expiresAt=rule.expiresAt?Date.parse(rule.expiresAt):null;
  const malformed=
    (rule.validFrom&&Number.isNaN(validFrom))||
    (rule.expiresAt&&Number.isNaN(expiresAt))||
    (validFrom!=null&&expiresAt!=null&&expiresAt<=validFrom);
  const beforeStart=validFrom!=null&&validFrom>now.getTime();
  const expired=expiresAt!=null&&expiresAt<=now.getTime();
  return rule.enabled!==false&&!malformed&&!beforeStart&&!expired;
}

function allowanceRank(value){
  return value===UNLIMITED_TIMELINES
    ?Number.POSITIVE_INFINITY
    :normalizeAllowance(value);
}

function strongestGrant(candidates,now){
  const active=candidates.filter(({rule})=>ruleActive(rule,now));
  const pool=active.length?active:candidates;
  return pool.slice().sort(
    (left,right)=>allowanceRank(right.rule.allowance)-
      allowanceRank(left.rule.allowance)
  )[0]||null;
}

export function defaultEntitlementConfiguration(){
  return{
    schemaVersion:TIMELINE_ENTITLEMENT_SCHEMA,
    enabled:true,
    eligibleRoles:["administrator"],
    eligibleMemberships:["360-match-mentorship"],
    roleAllowances:{administrator:UNLIMITED_TIMELINES},
    membershipAllowances:{"360-match-mentorship":1},
    individualUsers:{},
    cohorts:{},
    promotions:{},
    defaultTimelineAllowance:0
  };
}

export function resolveConfiguredEntitlement(principal={},configuration={},{
  now=new Date()
}={}){
  const config={...defaultEntitlementConfiguration(),...clone(configuration)};
  const userId=clean(principal.userId);
  const roles=normalizedSet(principal.roles);
  const memberships=normalizedSet(principal.memberships);
  const cohorts=normalizedSet(principal.cohorts);
  const promotions=normalizedSet(principal.promotions);
  const defaultAllowance=normalizeAllowance(config.defaultTimelineAllowance);
  if(config.enabled===false){
    return{
      enabled:false,
      eligible:false,
      allowance:0,
      source:"global-configuration",
      denialCode:"ENTITLEMENT_GLOBALLY_DISABLED",
      reason:"Timeline access is disabled by configuration."
    };
  }
  const individualUsers=normalizedRecord(config.individualUsers);
  const overrideKey=userId.toLowerCase();
  if(overrideKey&&Object.hasOwn(individualUsers,overrideKey)){
    const override=individualUsers[overrideKey];
    const rule=ruleValue(override,defaultAllowance);
    return{
      enabled:rule.enabled,
      eligible:ruleActive(rule,now),
      allowance:rule.allowance,
      source:"individual-user",
      denialCode:ruleActive(rule,now)?"":"INDIVIDUAL_OVERRIDE_DENIED",
      reason:rule.reason||"Individual Timeline entitlement override.",
      validFrom:rule.validFrom,
      expiresAt:rule.expiresAt
    };
  }
  const eligibleRoleIds=normalizedSet(config.eligibleRoles);
  const roleAllowances=normalizedRecord(config.roleAllowances);
  const eligibleMembershipIds=normalizedSet(config.eligibleMemberships);
  const membershipAllowances=normalizedRecord(config.membershipAllowances);
  const cohortRules=normalizedRecord(config.cohorts);
  const promotionRules=normalizedRecord(config.promotions);
  const candidates=[
    ...[...roles]
      .filter((id)=>eligibleRoleIds.has(id))
      .map((id)=>({
        id,
        source:"wordpress-role",
        label:`Eligible WordPress role: ${id}.`,
        rule:ruleValue(
          Object.hasOwn(roleAllowances,id)
            ?roleAllowances[id]
            :defaultAllowance,
          defaultAllowance
        )
      })),
    ...[...memberships]
      .filter((id)=>eligibleMembershipIds.has(id))
      .map((id)=>({
        id,
        source:"membership-level",
        label:`Eligible membership level: ${id}.`,
        rule:ruleValue(
          Object.hasOwn(membershipAllowances,id)
            ?membershipAllowances[id]
            :defaultAllowance,
          defaultAllowance
        )
      })),
    ...[...cohorts]
      .filter((id)=>Object.hasOwn(cohortRules,id))
      .map((id)=>({
        id,
        source:"cohort",
        label:`Eligible cohort: ${id}.`,
        rule:ruleValue(cohortRules[id],defaultAllowance)
      })),
    ...[...promotions]
      .filter((id)=>Object.hasOwn(promotionRules,id))
      .map((id)=>({
        id,
        source:"promotion",
        label:`Eligible promotion: ${id}.`,
        rule:ruleValue(promotionRules[id],defaultAllowance)
      }))
  ];
  const selected=strongestGrant(candidates,now);
  if(selected){
    const {rule}=selected;
    const active=ruleActive(rule,now);
    return{
      eligible:active,
      allowance:rule.allowance,
      source:selected.source,
      reason:rule.reason||selected.label,
      ...(rule.enabled===false?{enabled:false}:{}),
      ...(!active?{denialCode:"MATCHING_ENTITLEMENTS_INACTIVE"}:{}),
      ...(rule.validFrom?{validFrom:rule.validFrom}:{}),
      ...(rule.expiresAt?{expiresAt:rule.expiresAt}:{})
    };
  }
  return{
    eligible:false,
    allowance:defaultAllowance,
    source:"default",
    denialCode:"NO_MATCHING_ENTITLEMENT",
    reason:"No eligible WordPress role, 360 membership, override, cohort, or promotion."
  };
}

export function evaluateTimelineEntitlement(assertion={},{
  mode="local",
  hasExistingTimeline=false,
  now=new Date(),
  expectedBinding=null,
  maxAssertionAgeMs=300_000,
  clockSkewMs=300_000
}={}){
  const production=mode==="production";
  const usage=normalizeUsage(assertion.currentUsage);
  const assertionShapeValid=usage!==null&&(
    assertion.allowance===UNLIMITED_TIMELINES||
    normalizeUsage(assertion.allowance)!==null
  );
  const verifiedAtMs=Date.parse(clean(assertion.verifiedAt));
  const expiresAtMs=Date.parse(clean(assertion.expiresAt));
  const expectedPrincipal=clean(
    expectedBinding?.principalId||expectedBinding?.wpUserId
  );
  const assertedPrincipal=clean(
    assertion.principalId||assertion.wpUserId
  );
  const expectedIssuer=clean(expectedBinding?.issuer);
  const expectedAudience=clean(expectedBinding?.audience);
  const expectedMembershipVersion=clean(expectedBinding?.membershipVersion);
  const productionBindingValid=
    assertion.schemaVersion===TIMELINE_ENTITLEMENT_SCHEMA&&
    assertionShapeValid&&
    Number.isFinite(verifiedAtMs)&&
    Number.isFinite(expiresAtMs)&&
    verifiedAtMs>=now.getTime()-Math.max(0,Number(maxAssertionAgeMs)||0)&&
    verifiedAtMs<=now.getTime()+Math.max(0,Number(clockSkewMs)||0)&&
    expiresAtMs>verifiedAtMs&&
    expiresAtMs>now.getTime()&&
    Boolean(expectedPrincipal)&&
    assertedPrincipal===expectedPrincipal&&
    Boolean(expectedIssuer)&&
    clean(assertion.issuer)===expectedIssuer&&
    Boolean(expectedAudience)&&
    clean(assertion.audience)===expectedAudience&&
    Boolean(expectedMembershipVersion)&&
    clean(assertion.membershipVersion)===expectedMembershipVersion&&
    Boolean(clean(assertion.decisionId));
  const verified=assertion.verified===true&&(
    !production||productionBindingValid
  );
  const enabled=assertion.enabled!==false;
  const eligible=assertion.eligible===true;
  const currentUsage=usage??0;
  const allowance=normalizeAllowance(assertion.allowance);
  const expiresAt=clean(assertion.expiresAt);
  const expired=Boolean(
    expiresAt&&
    !Number.isNaN(Date.parse(expiresAt))&&
    Date.parse(expiresAt)<=now.getTime()
  );
  let reason=clean(assertion.reason);
  let denialCode=clean(assertion.denialCode);
  let access=ENTITLEMENT_ACCESS.FULL;
  if(production&&!verified){
    access=hasExistingTimeline?ENTITLEMENT_ACCESS.READ_ONLY:ENTITLEMENT_ACCESS.DENIED;
    reason="Timeline entitlement could not be verified.";
    denialCode=productionBindingValid
      ?"PRODUCTION_ENTITLEMENT_UNVERIFIED"
      :"PRODUCTION_ENTITLEMENT_MALFORMED";
  }else if(!enabled||expired||!eligible){
    access=hasExistingTimeline?ENTITLEMENT_ACCESS.READ_ONLY:ENTITLEMENT_ACCESS.DENIED;
    reason=reason||(
      expired
        ?"Timeline access expired."
        :"Timeline access is not currently enabled for this account."
    );
    denialCode=denialCode||(
      expired
        ?"ENTITLEMENT_EXPIRED"
        :!enabled
          ?"ENTITLEMENT_DISABLED"
          :"ENTITLEMENT_INELIGIBLE"
    );
  }else if(allowance===0){
    access=hasExistingTimeline?ENTITLEMENT_ACCESS.READ_ONLY:ENTITLEMENT_ACCESS.DENIED;
    reason=reason||"This account has a zero-timeline allowance.";
    denialCode=denialCode||"ZERO_TIMELINE_ALLOWANCE";
  }else if(
    allowance!==UNLIMITED_TIMELINES&&
    currentUsage>=allowance&&
    !hasExistingTimeline
  ){
    access=ENTITLEMENT_ACCESS.DENIED;
    reason=reason||
      "This account has reached its Timeline allowance and no existing timeline is available.";
    denialCode=denialCode||"TIMELINE_ALLOWANCE_REACHED";
  }
  const unlimited=allowance===UNLIMITED_TIMELINES;
  const canCreate=access===ENTITLEMENT_ACCESS.FULL&&(
    unlimited||currentUsage<allowance
  );
  const canMutate=access===ENTITLEMENT_ACCESS.FULL;
  const canExport=access===ENTITLEMENT_ACCESS.FULL;
  return Object.freeze({
    schemaVersion:TIMELINE_ENTITLEMENT_SCHEMA,
    permission:TIMELINE_ENTITLEMENT_PERMISSION,
    mode:production?"production":"local",
    verified,
    enabled,
    eligible,
    access,
    readOnly:access===ENTITLEMENT_ACCESS.READ_ONLY,
    denied:access===ENTITLEMENT_ACCESS.DENIED,
    canRead:access!==ENTITLEMENT_ACCESS.DENIED||Boolean(hasExistingTimeline),
    allowance,
    unlimited,
    currentUsage,
    remaining:unlimited?UNLIMITED_TIMELINES:Math.max(0,allowance-currentUsage),
    canCreate,
    canMutate,
    canExport,
    hasExistingTimeline:Boolean(hasExistingTimeline),
    source:clean(assertion.source)||"unknown",
    subjectKind:clean(assertion.subjectKind)||"unknown",
    reason:reason||"Timeline access verified.",
    administratorReason:clean(assertion.administratorReason)||
      reason||
      "Timeline access verified.",
    denialCode:access===ENTITLEMENT_ACCESS.FULL?"":denialCode||"ENTITLEMENT_DENIED",
    verifiedAt:clean(assertion.verifiedAt),
    expiresAt,
    destructiveEffects:false,
    productionWrites:false
  });
}

function localAssertion(scenario,currentUsage){
  const common={
    schemaVersion:TIMELINE_ENTITLEMENT_SCHEMA,
    verified:true,
    enabled:true,
    eligible:true,
    currentUsage,
    source:"local-entitlement-adapter",
    subjectKind:scenario
  };
  switch(scenario){
    case"administrator":
      return{...common,allowance:UNLIMITED_TIMELINES,reason:"WordPress Administrator access (local proof)."};
    case"eligible-360":
      return{...common,allowance:1,reason:"360 Match Mentorship access (local proof)."};
    case"zero":
      return{...common,allowance:0,reason:"Timeline allowance is set to zero."};
    case"one":
      return{...common,allowance:1,currentUsage:1,reason:"One of one timelines is in use."};
    case"unlimited":
      return{...common,allowance:UNLIMITED_TIMELINES,reason:"Unlimited Timeline allowance (local proof)."};
    case"override":
      return{...common,allowance:2,source:"individual-user",reason:"Explicit user override (local proof)."};
    case"removed":
      return{
        ...common,
        enabled:false,
        eligible:false,
        allowance:1,
        currentUsage:Math.max(1,currentUsage),
        reason:"Timeline access was removed. Existing data remains read-only."
      };
    default:
      return{
        ...common,
        eligible:false,
        allowance:0,
        reason:"This account is not eligible for Timeline access."
      };
  }
}

export function createLocalEntitlementAdapter({
  scenario="eligible-360",
  currentUsage=1
}={}){
  const normalized=LOCAL_SCENARIOS.has(scenario)?scenario:"ineligible";
  return Object.freeze({
    id:"d1-405-local-entitlement",
    executionMode:"local",
    metadata:Object.freeze({
      executionMode:"local",
      networkCalls:false,
      wordpressWrites:false,
      matrixWrites:false,
      productionWrites:false
    }),
    async resolve(){
      return clone(localAssertion(normalized,currentUsage));
    }
  });
}

export function createProductionEntitlementBoundaryAdapter(){
  return Object.freeze({
    id:"d1-405-production-entitlement-boundary",
    executionMode:"production",
    metadata:Object.freeze({
      executionMode:"production",
      connected:false,
      networkCalls:false,
      wordpressWrites:false,
      matrixWrites:false,
      productionWrites:false
    }),
    async resolve(){
      return{
        schemaVersion:TIMELINE_ENTITLEMENT_SCHEMA,
        verified:false,
        enabled:false,
        eligible:false,
        allowance:0,
        currentUsage:0,
        source:"unavailable-production-boundary",
        reason:"Timeline entitlement could not be verified."
      };
    }
  });
}

export function localEntitlementScenarioFromLocation(location){
  const host=clean(location?.hostname).toLowerCase();
  if(!["localhost","127.0.0.1","0.0.0.0"].includes(host))return null;
  const scenario=new URLSearchParams(clean(location?.search)).get("entitlement");
  return LOCAL_SCENARIOS.has(scenario)?scenario:null;
}

export function entitlementStatusMarkup(access){
  const allowance=access.unlimited
    ?"Unlimited timelines"
    :access.allowance===0&&access.hasExistingTimeline
      ?"0 allowed · existing timeline preserved"
      :`${access.currentUsage} of ${access.allowance} timelines used`;
  const label=access.access===ENTITLEMENT_ACCESS.FULL
    ?access.subjectKind==="administrator"
      ?"Administrator access"
      :access.subjectKind==="eligible-360"
        ?"360 member access"
        :"Timeline access"
    :access.access===ENTITLEMENT_ACCESS.READ_ONLY
      ?"Read-only access"
      :"Access unavailable";
  return{
    label,
    allowance,
    reason:access.reason,
    tone:access.access===ENTITLEMENT_ACCESS.FULL?"success":"warning"
  };
}
