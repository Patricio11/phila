import { describe, it, expect } from "vitest";
import { applyMention, mentionCandidates, mentionQueryAt, mentionedUserIds, parseMentions, sanitiseMentions, splitMentions, stripMentionTokens, tokeniseMentions } from "@/lib/messaging/mentions";

/* Batch 4n - @mentions: plain in the box, tokens in the body, validated on the server. */
const MEMBERS = [
  { userId: "user_thabo", name: "Thabo Mokoena" },
  { userId: "user_thabo2", name: "Thabo Mokoena-Smith" },
  { userId: "user_nomsa", name: "Nomsa Dlamini" },
  { userId: "user_me", name: "Thandeka Mbeki" },
];

describe("mentions", () => {
  it("tokenises whole names only, longest first, and round-trips to plain", () => {
    const t = tokeniseMentions("hey @Thabo Mokoena-Smith and @Thabo Mokoena, @Nomsa Dlamini? not @Nomsa", MEMBERS);
    expect(t).toBe("hey @[Thabo Mokoena-Smith](user_thabo2) and @[Thabo Mokoena](user_thabo), @[Nomsa Dlamini](user_nomsa)? not @Nomsa");
    expect(stripMentionTokens(t)).toBe("hey @Thabo Mokoena-Smith and @Thabo Mokoena, @Nomsa Dlamini? not @Nomsa");
    expect(parseMentions(t).map((m) => m.userId)).toEqual(["user_thabo2", "user_thabo", "user_nomsa"]);
    // emails are not mentions
    expect(tokeniseMentions("mail me at x@Thabo Mokoena.com", MEMBERS)).toBe("mail me at x@Thabo Mokoena.com");
  });

  it("sanitise flattens tokens for non-members; mentionedUserIds respects the member set", () => {
    const body = "@[Thabo Mokoena](user_thabo) and @[Stranger](user_x)";
    expect(sanitiseMentions(body, MEMBERS)).toBe("@[Thabo Mokoena](user_thabo) and @Stranger");
    expect(mentionedUserIds(body, MEMBERS)).toEqual(["user_thabo"]);
    expect(mentionedUserIds(body)).toEqual(["user_thabo", "user_x"]);
  });

  it("splits a body into text + mention segments", () => {
    expect(splitMentions("hi @[Thabo Mokoena](user_thabo)!")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", name: "Thabo Mokoena", userId: "user_thabo" },
      { kind: "text", text: "!" },
    ]);
    expect(splitMentions("plain")).toEqual([{ kind: "text", text: "plain" }]);
  });

  it("finds the @query under the caret (one inner space allowed) and stops after a finished name + words", () => {
    expect(mentionQueryAt("hello @tha", 10)).toEqual({ start: 6, query: "tha" });
    expect(mentionQueryAt("@thabo mo", 9)).toEqual({ start: 0, query: "thabo mo" });
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionQueryAt("@Thabo Mokoena is here", 22)).toBeNull();
    expect(mentionQueryAt("x@y", 3)).toBeNull();
    expect(mentionQueryAt("hello @tha", 3)).toBeNull();
  });

  it("ranks candidates (name prefix, word prefix, substring) and never offers me", () => {
    expect(mentionCandidates("", MEMBERS, "user_me").map((m) => m.userId)).toEqual(["user_thabo", "user_thabo2", "user_nomsa"]);
    expect(mentionCandidates("mok", MEMBERS, "user_me").map((m) => m.userId)).toEqual(["user_thabo", "user_thabo2"]);
    expect(mentionCandidates("dlam", MEMBERS, "user_me").map((m) => m.userId)).toEqual(["user_nomsa"]);
    expect(mentionCandidates("thand", MEMBERS, "user_me")).toEqual([]);
    expect(mentionCandidates("zzz", MEMBERS, "user_me")).toEqual([]);
  });

  it("applies a pick in place and moves the caret after it", () => {
    const r = applyMention("hello @tha there", 6, 10, MEMBERS[0]!);
    expect(r.text).toBe("hello @Thabo Mokoena  there");
    expect(r.caret).toBe(6 + "@Thabo Mokoena ".length);
  });
});
