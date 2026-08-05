import { useEffect, useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { fetchMe } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function ProfileScreen() {
  const { status, signOut } = useAuth();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") {
      setUsername(null);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUsername(me.username ?? me.rovas_uid);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (status === "signedIn") {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Civic</Text>
        <Text style={styles.body}>{t("profile.signed_in")}</Text>
        {username ? (
          <Text style={styles.meta}>
            {t("profile.username")}: @{username}
          </Text>
        ) : null}
        <Pressable
          style={styles.btn}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.btnText}>{t("profile.sign_out")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Civic</Text>
      <Text style={styles.body}>{t("profile.signed_out")}</Text>
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>{t("home.sign_in")}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  brand: { fontSize: 24, fontWeight: "700", color: colors.brand },
  body: { color: colors.muted, lineHeight: 22 },
  meta: { color: colors.ink, fontWeight: "600" },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
