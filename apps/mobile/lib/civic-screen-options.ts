import { CivicScreenHeader } from "@/components/CivicScreenHeader";
import { colors } from "@/constants/theme";

export const civicStackScreenOptions = {
  header: CivicScreenHeader,
  headerShown: true,
  contentStyle: { backgroundColor: colors.bg },
  // Header props come from React Navigation; keep loose for tab + stack layouts.
} as Record<string, unknown>;
