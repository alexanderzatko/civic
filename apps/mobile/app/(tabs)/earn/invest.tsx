import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import type { CharityProject } from "@civic/shared";
import { colors } from "@/constants/theme";
import { fetchProjects } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";

export default function InvestScreen() {
  useLocale();
  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects("invest")
      .then((r) => setProjects(r.projects))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hint}>{t("invest.stub")}</Text>
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
          {p.expected_yield_me_per_year != null ? (
            <Text style={styles.yield}>
              ~{p.expected_yield_me_per_year} ME / rok
            </Text>
          ) : null}
          <Text style={styles.link}>{t("common.open")} →</Text>
        </Pressable>
      ))}
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
  yield: { color: colors.ink, fontWeight: "600", marginTop: 4 },
  link: { color: colors.brand, fontWeight: "700", marginTop: 6 },
});
