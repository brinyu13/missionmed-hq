// A route chooses a presentation role only inside the admitted role set.
export function advancedEntryRole(hash, allowed) {
  return hash === '#mentor?view=admin' && allowed.has('admin') ? 'admin' : 'student';
}
export function reviewScopeLabel({identity, role, saved, selected, view}) {
  const actor = identity?.displayName || identity?.subject || 'Signed in';
  const base = `Signed in: ${actor} · ${role === 'admin' ? 'Admin' : role === 'mentor' ? 'Mentor' : 'Student'}`;
  if (role !== 'admin' || !selected?.subject) return base;
  if (view !== 'mentor' && (saved?.reviewScope !== 'admin' || saved.session?.ownerSubject !== selected.subject)) return base;
  return `${base} · Reviewing: ${selected.displayName || 'Selected student'} · ${selected.subject}`;
}
