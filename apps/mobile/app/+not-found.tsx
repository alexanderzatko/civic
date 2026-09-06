import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { AppSplash } from "@/components/AppSplash";

/**
 * Unmatched routes (including brief deep-link races) show the splash
 * instead of an error, then recover to Home.
 */
export default function NotFoundScreen() {
  useEffect(() => {
    router.replace("/(tabs)");
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppSplash />
    </>
  );
}
