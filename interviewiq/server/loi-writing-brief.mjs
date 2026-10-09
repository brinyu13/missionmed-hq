// Narrow LOI adaptation of PSForge's applicant-centered editorial strategy.
// Donor: program-specific-ps-engine@1bea1f40550a66575f7ccf8af0fcb4eee7d721d1,
// class-mmps-generator.php baseline_system_prompt / baseline_strategies.
// No donor runtime, student record, credential, schema or provider is imported.
export const LOI_WRITING_BRIEF_VERSION='iiq-loi-writing-brief-v1';

const STRATEGIES=Object.freeze({
 WARM_PERSONAL:{openingKind:'reason',opening:'Begin with the confirmed personal reason in the student’s own register.',organization:'Develop that reason through the selected program evidence, then the current purpose.',closing:'Close with a restrained, courteous acknowledgment.'},
 DIRECT_CONCISE:{openingKind:'context',opening:'Begin with the confirmed Why Now and current application or interview context.',organization:'Make one concise evidence-to-reason connection; keep each sentence purposeful.',closing:'Close briefly without repeating the application status.'},
 ACADEMIC_PROGRAM:{openingKind:'evidence',opening:'Begin with the selected concrete program detail, without implying an unsupported offering.',organization:'Explain why that detail matters to the confirmed student objective, then the current purpose.',closing:'Close courteously without another catalogue of program features.'},
 POST_INTERVIEW:{openingKind:'context',opening:'Begin from the explicitly confirmed interview context.',organization:'Connect only confirmed reflections to selected evidence and the student’s reason for writing now.',closing:'Close reflectively without inventing an interview event or relationship.'},
 UPDATE_LED:{openingKind:'fact',opening:'Begin with the explicitly confirmed student update.',organization:'Explain its relevance to the selected program evidence and genuine motivation.',closing:'Close without inflating the update into an achievement or promise.'},
 STRONG_INTEREST:{openingKind:'reason',opening:'Begin with the confirmed specific motivation behind this interest.',organization:'Develop a clear student-to-program connection and the confirmed current purpose.',closing:'Close sincerely without a rank, exclusivity promise or guarantee.'}
});

export const LOI_EDITORIAL_INSTRUCTIONS=[
 'Use writingBrief as a grouped view of the SAME original references, not as new factual evidence. Only original refs supply source text and IDs.',
 'Write in first person. Let confirmed personal reasons and facts determine the register, vocabulary and emphasis; do not manufacture a biography, voice sample or emotional intensity.',
 'Build one applicant-centered argument. Explain why the selected concrete program evidence matters to this student; do not catalogue facts or substitute generic enthusiasm for a supported connection.',
 'All original references remain required under the existing coverage contract. Combine compatible sources naturally without changing their meaning. Thin personal context means shorter and plainer prose, never padding.',
 'For three explicitly requested approaches, use the same factual truth with different opening logic, organization, emphasis and cadence. Different students differ because their confirmed reasons, purpose and updates differ, not because of random synonyms.',
 'Silently edit once within this SAME response: remove stock praise, repeated interest, unsupported implications and sentences that would survive both a program and applicant swap. Do not request a repair call or certify your own factual accuracy.',
 'Keep the final courteous closing brief and nonfactual. Do not repeat the canonical program name, application/interview status, evidence or personal assertions there. A paragraph with any factual assertion must carry its own narrowly relevant refs.',
 'Before returning JSON, check the actual wording of every paragraph against its own linked source texts. Never attach an irrelevant ID to make a check pass. Student review and approval remain mandatory.'
].join(' ');

// Pure projection from the already-governed compositionInput.refs. Do not read
// arbitrary client fields or enrich from another student's data / product store.
export function buildLoiWritingBrief(input){
 const refs=input.refs;
 const project=r=>({ref:r.ref,text:r.text});
 const byKind=kind=>refs.filter(r=>r.kind===kind).map(project);
 const byId=id=>refs.filter(r=>r.ref===id&&r.kind==='context').map(project);
 return {
  version:LOI_WRITING_BRIEF_VERSION,
  canonicalProgram:byKind('identity'),
  whyNow:byId('context:whyNow'),
  applicationContext:byId('context:applicationState'),
  interviewContext:byId('context:interviewState'),
  confirmedPersonalReasons:byKind('reason'),
  confirmedPersonalFacts:byKind('fact'),
  selectedProgramEvidence:byKind('evidence'),
  otherConfirmedContext:refs.filter(r=>r.kind==='context'&&!['context:whyNow','context:applicationState','context:interviewState'].includes(r.ref)).map(project),
  requestedStrategies:input.approaches.map(approach=>({approach,...STRATEGIES[approach]}))
 };
}
