// This describes the already-authorized document. It never grants access or edits it.
export function selectedSubjectForDocument022(runtime,document){
  const client=runtime?.authClient,identity=client?.bootstrapState,subject=runtime?.subject;
  if(!client||client.locked||identity?.role!=='PROGRAM_ADMIN'||identity.adminWorkspace!==true||
    !identity.principalId||identity.principalId!==runtime.identity?.principalId||
    typeof document?.id!=='string'||!document.id.trim()||!subject?.principalId||subject.documentId!==document?.id||subject.principalId!==document?.studentOwnerId||
    typeof subject.displayName!=='string'||!subject.displayName.trim())return null;
  return Object.freeze({displayName:subject.displayName.trim(),documentId:document.id,studentPrincipalId:subject.principalId});
}

let sequence=0;
export function attachSelectedSubjectDialog022(dialog,{runtime,document}={}){
  if(!dialog?.ownerDocument)return null;
  let context=dialog.querySelector(':scope > [data-selected-subject-context-022]');
  const subject=selectedSubjectForDocument022(runtime,document);
  if(!subject){
    if(context){dialog.setAttribute('aria-describedby',(dialog.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==context.id).join(' '));context.remove();}
    return null;
  }
  if(!context){
    context=dialog.ownerDocument.createElement('div');context.className='family022DialogSubject';context.id=`timeline-dialog-subject-022-${++sequence}`;
    context.setAttribute('data-selected-subject-context-022','');
    const label=dialog.ownerDocument.createElement('span');label.className='family022Eyebrow';label.textContent='VIEWING TIMELINE FOR';
    context.append(label,dialog.ownerDocument.createElement('strong'));dialog.prepend(context);
    const description=(dialog.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);description.push(context.id);dialog.setAttribute('aria-describedby',description.join(' '));
  }
  context.querySelector('strong').textContent=subject.displayName;
  return context;
}
