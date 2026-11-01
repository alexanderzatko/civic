import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useTrustedNotifyRefresh } from "@/lib/useTrustedNotifyRefresh";

/** Poll Trusted congratulations notify while signed in (mount once under tabs). */
export function TrustedNotifyHost({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  useTrustedNotifyRefresh(status === "signedIn");
  return children;
}
