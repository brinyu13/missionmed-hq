// /library?scope=own is filtered server-side by the authenticated actor.
// The API intentionally omits ownerSubject in this projection. Binding display
// scope here is not an authorization grant; fresh own membership remains mandatory.
export function bindOwnRow(row,subject) {
  if(!/^wp:[1-9][0-9]*$/.test(String(subject||'')) || !row?.id
    || (row.ownerSubject != null && row.ownerSubject!==subject)) return null;
  return {...row,ownerSubject:subject};
}
export function bindOwnLibrary(library,subject) {
  return {...library,sessions:(Array.isArray(library?.sessions)?library.sessions:[]).map(row=>bindOwnRow(row,subject)).filter(Boolean)};
}
