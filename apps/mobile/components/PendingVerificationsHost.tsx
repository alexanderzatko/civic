import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { usePendingVerificationsRefresh } from "@/lib/usePendingVerificationsRefresh";

/** Poll pending verifications while signed in (mount once under tabs). */
export function PendingVerificationsHost({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  usePendingVerificationsRefresh(status === "signedIn");
  return children;
}
