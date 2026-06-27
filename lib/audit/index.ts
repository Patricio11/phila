/**
 * Audit log — `logAccess()` is invoked on every PII read/export and every
 * privileged action (Protected & Audited Rule). In Part A it writes to a
 * console/in-memory sink so the *call sites* exist from commit one; Phase 10
 * swaps the sink for the persistent `audit_log` table with no call-site change.
 *
 * The rule that matters: the Hub reading a private note, a super-admin crossing
 * orgs, a funder opening a grant view — each is a recorded access, never silent.
 */
import type { PlatformRole, TeamRole } from "@/lib/domain/enums";

export type AuditAction =
  | "pii.read"
  | "pii.export"
  | "note.read"
  | "note.read_hub_override"
  | "demographics.read"
  | "funder.view"
  | "impersonate.start"
  | "impersonate.end"
  | "consent.change"
  | "file.access"
  | "admin.action";

export interface AuditEvent {
  action: AuditAction;
  /** Who performed it. */
  actor: {
    userId: string;
    platformRole: PlatformRole | null;
    teamRole: TeamRole | null;
  };
  /** Tenant scope (null only for platform-level actions). */
  orgId: string | null;
  /** What was touched: `client:abc`, `note:123`, `grant:g1`, … */
  target: string;
  /** Why — purpose/justification, kept honest. */
  reason?: string;
  meta?: Record<string, string | number | boolean>;
  at: string;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void> | void;
}

/** Default Part-A sink: structured console line + in-memory ring for the demo. */
class MemoryAuditSink implements AuditSink {
  private readonly ring: AuditEvent[] = [];
  private readonly limit = 500;

  write(event: AuditEvent): void {
    this.ring.push(event);
    if (this.ring.length > this.limit) this.ring.shift();
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[audit] ${event.action} actor=${event.actor.userId} org=${event.orgId ?? "-"} target=${event.target}${event.reason ? ` reason=${event.reason}` : ""}`,
      );
    }
  }

  recent(): readonly AuditEvent[] {
    return this.ring;
  }
}

const sink: AuditSink = new MemoryAuditSink();

export async function logAccess(event: Omit<AuditEvent, "at"> & { at?: string }): Promise<void> {
  await sink.write({ ...event, at: event.at ?? new Date().toISOString() });
}
