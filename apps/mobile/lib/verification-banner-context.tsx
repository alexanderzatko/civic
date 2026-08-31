import { createContext, type ReactNode } from "react";
import type { PendingVerificationItem } from "@civic/shared";

export type VerificationBannerSlot = {
  visible: boolean;
  items: PendingVerificationItem[];
};

export const verificationBannerContext = createContext<VerificationBannerSlot>({
  visible: false,
  items: [],
});

export function VerificationBannerProvider({
  value,
  children,
}: {
  value: VerificationBannerSlot;
  children: ReactNode;
}) {
  return (
    <verificationBannerContext.Provider value={value}>
      {children}
    </verificationBannerContext.Provider>
  );
}
