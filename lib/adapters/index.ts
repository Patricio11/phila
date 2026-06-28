/**
 * The dormant adapter set (Part A). Everything is "off": storage/AI/payments/
 * video throw `AdapterDormantError` if called, and notifications queue but never
 * deliver  exactly matching the UI's honest "nothing sends until messaging is
 * connected" copy. Part B replaces these with live implementations behind the
 * same interfaces (`lib/adapters/types.ts`); call sites don't change.
 */
import { AdapterDormantError, type Adapters } from "@/lib/adapters/types";

function dormant(name: string): never {
  throw new AdapterDormantError(name);
}

export const adapters: Adapters = {
  storage: {
    status: "off",
    async put() { return dormant("Storage"); },
    async signedUrl() { return dormant("Storage"); },
  },
  notifications: {
    status: { whatsapp: "off", sms: "off", email: "off" },
    // Honest: accepted into the queue, but not delivered while the rail is dormant.
    async send() { return { queued: true, delivered: false }; },
  },
  ai: {
    status: "off",
    async draftNote() { return dormant("AI assistant"); },
  },
  payments: {
    status: "off",
    async charge() { return dormant("Payments"); },
  },
  video: {
    status: "off",
    async createRoom() { return dormant("Video"); },
  },
};

/** Resolve the active adapter set. Part B selects live vs mock per configured org/feature. */
export function getAdapters(): Adapters {
  return adapters;
}

export * from "@/lib/adapters/types";
