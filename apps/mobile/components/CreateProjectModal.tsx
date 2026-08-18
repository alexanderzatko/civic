import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
import { createProject } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (project: { project_nid: string; title: string }) => void;
};

export function CreateProjectModal({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setDescription("");
    setError(null);
    setBusy(false);
  }, [visible]);

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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.back}>{t("common.back")}</Text>
          </Pressable>
          <Text style={styles.title}>{t("volunteer.create_title")}</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { color: colors.brand, fontWeight: "700", width: 48 },
  title: { fontWeight: "700", color: colors.ink, fontSize: 16 },
  body: { padding: 20, gap: 10 },
  label: { fontWeight: "600", color: colors.ink, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
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
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700" },
});
