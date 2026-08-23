import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/constants/theme";
import { createProject } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  open: boolean;
  onToggle: () => void;
  onCreated: (project: { project_nid: string; title: string }) => void;
  disabled?: boolean;
};

export function CreateProjectSection({
  open,
  onToggle,
  onCreated,
  disabled = false,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setError(null);
    setBusy(false);
  }, [open]);

  const canSubmit = useMemo(
    () => name.trim().length > 0 && description.trim().length > 0 && !busy,
    [name, description, busy],
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createProject({
        name: name.trim(),
        description: description.trim(),
      });
      if (!res.ok) {
        setError(res.message || t("volunteer.create_error"));
        return;
      }
      onCreated({ project_nid: res.project_nid, title: name.trim() });
    } catch {
      setError(t("volunteer.create_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {t("volunteer.create_project")}
        </Text>
        <View style={styles.chevronWrap}>
          <MaterialIcons
            name={open ? "expand-more" : "chevron-right"}
            size={24}
            color={colors.muted}
            style={styles.chevronIcon}
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Text style={styles.label}>{t("volunteer.create_name")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("volunteer.create_name_placeholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>{t("volunteer.create_description")}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("volunteer.create_description_placeholder")}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.area]}
            multiline
            textAlignVertical="top"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t("volunteer.create_submit")}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink, flex: 1 },
  titleDisabled: { opacity: 0.5 },
  chevronWrap: {
    width: 24,
    height: 24,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronIcon: {
    transform: [{ scale: 1.25 }],
  },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  label: { fontWeight: "600", color: colors.ink, fontSize: 13 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  area: { minHeight: 100 },
  error: { color: colors.danger, fontSize: 14 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
});
