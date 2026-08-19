/**
 * Batch 4n - @mentions in Messages. Pure helpers shared by the composer, the
 * bubble renderer, and the server (send + nudge).
 *
 * Storage format inside a message body: `@[Thabo Mokoena](user_thabo)`. The
 * composer never shows that - people type / pick `@Thabo Mokoena` and the token
 * is made at send time from the thread's members (and unmade again for editing,
 * previews and quotes). The server re-validates: a token whose id is not a
 * member of the thread is flattened back to plain `@Name`.
 */

export interface MentionMember { userId: string; name: string }

const TOKEN = /@\[([^\]\n]{1,80})\]\(([A-Za-z0-9_:-]{1,80})\)/g;

/** Every `@[Name](id)` token in a body, in order (duplicates kept). */
export function parseMentions(text: string): { userId: string; name: string }[] {
  const out: { userId: string; name: string }[] = [];
  for (const m of (text ?? "").matchAll(TOKEN)) out.push({ name: m[1]!, userId: m[2]! });
  return out;
}

/** Distinct mentioned user ids, optionally limited to a member set. */
export function mentionedUserIds(text: string, members?: MentionMember[]): string[] {
  const allowed = members ? new Set(members.map((m) => m.userId)) : null;
  const ids = new Set<string>();
  for (const m of parseMentions(text)) if (!allowed || allowed.has(m.userId)) ids.add(m.userId);
  return Array.from(ids);
}

/** Tokens → plain `@Name` (for the composer, previews, quotes, search). */
export function stripMentionTokens(text: string): string {
  return (text ?? "").replace(TOKEN, (_m, name: string) => `@${name}`);
}

/** Keep tokens only for real members; anyone else flattens to `@Name`. */
export function sanitiseMentions(text: string, members: MentionMember[]): string {
  const allowed = new Set(members.map((m) => m.userId));
  return (text ?? "").replace(TOKEN, (whole: string, name: string, id: string) => (allowed.has(id) ? whole : `@${name}`));
}

/**
 * Plain `@First Last` → token, longest names first so "@Thabo Mokoena-Smith"
 * isn't eaten by "@Thabo Mokoena". Only whole names followed by a boundary.
 */
export function tokeniseMentions(text: string, members: MentionMember[]): string {
  let out = text ?? "";
  const sorted = [...members].filter((m) => m.name.trim()).sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    const esc = m.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\w\\]])@${esc}(?![\\w(])`, "g");
    out = out.replace(re, (_whole, pre: string) => `${pre}@[${m.name.trim()}](${m.userId})`);
  }
  return out;
}

export type MentionSegment = { kind: "text"; text: string } | { kind: "mention"; userId: string; name: string };

/** Split a body into text + mention segments for rendering. */
export function splitMentions(text: string): MentionSegment[] {
  const segs: MentionSegment[] = [];
  let last = 0;
  const src = text ?? "";
  for (const m of src.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) segs.push({ kind: "text", text: src.slice(last, i) });
    segs.push({ kind: "mention", name: m[1]!, userId: m[2]! });
    last = i + m[0].length;
  }
  if (last < src.length) segs.push({ kind: "text", text: src.slice(last) });
  return segs;
}

/**
 * Is the caret inside an `@query` the composer should offer completions for?
 * Returns the query + where the `@` starts, or null. The query may hold one
 * space ("@tha mo") so two-word names complete; a finished name followed by a
 * space + more words stops offering.
 */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const upto = (text ?? "").slice(0, Math.max(0, caret));
  const m = /(^|\s)@([^\s@]{0,40}(?: [^\s@]{0,40})?)$/.exec(upto);
  if (!m) return null;
  const start = upto.length - m[0].length + m[1]!.length;
  return { start, query: m[2] ?? "" };
}

/** Members whose name matches the query (prefix of any word first, then substring), never myself. */
export function mentionCandidates(query: string, members: MentionMember[], myUserId: string, limit = 6): MentionMember[] {
  const q = query.trim().toLowerCase();
  const others = members.filter((m) => m.userId !== myUserId);
  if (!q) return others.slice(0, limit);
  const score = (m: MentionMember) => {
    const name = m.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    return -1;
  };
  return others.map((m) => ({ m, s: score(m) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.m.name.localeCompare(b.m.name)).slice(0, limit).map((x) => x.m);
}

/** Replace the `@query` at `start..caret` with `@Full Name ` and return the new text + caret. */
export function applyMention(text: string, start: number, caret: number, member: MentionMember): { text: string; caret: number } {
  const insert = `@${member.name.trim()} `;
  const next = (text ?? "").slice(0, start) + insert + (text ?? "").slice(caret);
  return { text: next, caret: start + insert.length };
}
