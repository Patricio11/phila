"use client";

import type { BusinessHours } from "@/lib/domain/types";
import { AvailabilityEditor, type Window } from "@/components/hub/availability-editor";
import { saveMyAvailability } from "@/lib/account/actions";

/**
 * Batch 2n - a counsellor keeps their OWN weekly hours, split by how they meet
 * (any session / in person / online). The practice still has oversight: every
 * save rings the admins' bell and lands on the activity feed, and it is the
 * same editor an admin uses, so both sides see one truth.
 */
export function MyAvailabilityCard({ firstName, initial, orgHours }: {
  firstName: string;
  initial: Window[];
  orgHours: BusinessHours;
}) {
  return (
    <AvailabilityEditor
      counsellorId=""
      firstName={firstName === "You" ? "You" : firstName}
      initial={initial}
      orgHours={orgHours}
      save={(windows) => saveMyAvailability({ windows })}
      note="Your practice is notified whenever you change this, and it appears on their activity feed. Bookings only offer you when the whole session fits a window that allows that session type."
    />
  );
}
