import { useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  getPendingVerifications,
  subscribePendingVerifications,
} from "@/lib/pending-verifications";
import { usePendingVerificationsRefresh } from "@/lib/usePendingVerificationsRefresh";
import { VerificationBannerProvider } from "@/lib/verification-banner-context";

/** Poll pending verifications while signed in (mount once under tabs). */
export function PendingVerificationsHost({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  usePendingVerificationsRefresh(signedIn);
  const pending = useSyncExternalStore(
    subscribePendingVerifications,
    getPendingVerifications,
    getPendingVerifications,
  );

  return (
    <VerificationBannerProvider
      value={{
        visible:
          signedIn && pending.total > 0 && pending.items.length > 0,
        items: pending.items,
      }}
    >
      {children}
    </VerificationBannerProvider>
  );
}
