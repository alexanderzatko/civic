import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CharityProject } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchProjects } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function CharityScreen() {
  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects("charity")
      .then((r) => setProjects(r.projects))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hint}>{t("charity.stub")}</Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {projects.map((p) => (
        <Pressable
          key={p.id}
          style={styles.card}
          onPress={() => void Linking.openURL(p.rovas_url)}
        >
          <Text style={styles.title}>{p.title}</Text>
          <Text style={styles.org}>{p.organization}</Text>
          <Text style={styles.summary}>{p.summary}</Text>
          <Text style={styles.link}>{t("common.open")} →</Text>
        </Pressable>
      ))}
      <View style={styles.invite}>
        <Text style={styles.inviteTitle}>{t("charity.invite")}</Text>
        <Text style={styles.hint}>{t("charity.invite_hint")}</Text>
        <Pressable
          onPress={() =>
            void Linking.openURL("https://rovas.app/charity-projects")
          }
        >
          <Text style={styles.link}>rovas.app/charity-projects</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  hint: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  org: { color: colors.brandSoft, fontWeight: "600", fontSize: 13 },
  summary: { color: colors.muted, fontSize: 14 },
  link: { color: colors.brand, fontWeight: "700", marginTop: 6 },
  invite: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#E8EFEA",
    gap: 6,
  },
  inviteTitle: { fontWeight: "700", color: colors.ink },
});
