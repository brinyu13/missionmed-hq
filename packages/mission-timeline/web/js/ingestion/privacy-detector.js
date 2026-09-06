const PRIVACY_RULES=[
  ["FAMILY",/\b(?:pregnan(?:t|cy)|parental(?: leave| responsibilities?)?|maternity|paternity|raising (?:a |my )?(?:daughter|son|child)|daughter|son|child(?:care)?|baby|spouse|husband|wife|family (?:transition|reasons?|care|caregiving|responsibilit(?:y|ies)|circumstances?)|caregiver|in-laws?)\b/i],
  ["IMMIGRATION",/\b(visa|immigration|asylum|refugee|green card|work permit|citizenship)\b/i],
  ["HEALTH",/\b(health condition|mental health|behavioral health|psychiatric|illness|medical leave|disability|diagnosis|treatment|hospitalized)\b/i],
  ["LEGAL",/\b(legal matter|lawsuit|court|arrest|criminal|probation)\b/i],
  ["FINANCIAL",/\b(financial hardship|bankruptcy|debt|foreclosure)\b/i],
  ["IDENTITY",/\b(gender identity|sexual orientation|religion|ethnicity)\b/i]
];

export function detectPrivacy(record,{classification=null}={}){
  const text=[record.title,record.description,record.rawText,record.section].filter(Boolean).join(" ");
  const flags=PRIVACY_RULES.filter(([,pattern])=>pattern.test(text)).map(([type])=>type);
  const privateByTaxonomy=classification?.canonicalType==="PERSONAL_NOT_ON_CV"||classification?.categoryId==="personal";
  if(privateByTaxonomy&&!flags.includes("PERSONAL_CONTEXT"))flags.push("PERSONAL_CONTEXT");
  const sensitive=flags.length>0||privateByTaxonomy;
  return {
    sensitive,
    flags,
    recommendation:sensitive?"ADVISOR_ONLY":"INTERVIEWER_SAFE",
    rationale:sensitive?["Potentially sensitive context requires explicit human visibility approval."]:[],
    requiresExplicitDisclosure:sensitive,
    privateByTaxonomy,
    legalOrMedicalJudgment:false
  };
}
