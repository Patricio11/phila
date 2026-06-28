import { auth } from "@/lib/auth/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

/** Better Auth's handler — sign-in, sign-up, session, reset, etc. (Phase 9). */
export const { GET, POST } = toNextJsHandler(auth);
