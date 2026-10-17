import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { usePendingCommentNoticesRefresh } from "@/lib/usePendingCommentNoticesRefresh";

/** Poll pending watched-comment notices while signed in (mount once under tabs). */
export function PendingCommentNoticesHost({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  usePendingCommentNoticesRefresh(status === "signedIn");
  return children;
}
