"use client";

import { createAuthClient } from "better-auth/react";

/** Browser auth client — sign-in / sign-up / sign-out from forms (Phase 9). */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
