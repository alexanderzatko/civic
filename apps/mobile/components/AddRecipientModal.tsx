import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { UserSearchResult } from "@civic/shared";
import { colors } from "@/constants/theme";
import { searchUsers } from "@/lib/api";
import {
  loadRecipientMemory,
  setAlwaysShare,
  type MemoryRecipient,
} from "@/lib/recipient-memory";
import { t } from "@/lib/i18n";

type Props = {
  visible: boolean;
  excludeUids: Set<string>;
  onClose: () => void;
  onPick: (user: {
    rovas_uid: string;
    username: string;
    display_name: string;
    alwaysShare: boolean;
  }) => void;
};

export function AddRecipientModal({
  visible,
  excludeUids,
  onClose,
  onPick,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [memory, setMemory] = useState<MemoryRecipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setResults([]);
    setSearchError(false);
    void loadRecipientMemory().then(setMemory);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(false);
    const handle = setTimeout(() => {
      void searchUsers(q)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows.filter((r) => !excludeUids.has(r.rovas_uid)));
          setSearching(false);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setSearching(false);
          setSearchError(true);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, visible, excludeUids]);

  const onToggleMemoryAlways = useCallback(
    async (uid: string, value: boolean) => {
      const next = await setAlwaysShare(uid, value);
      setMemory(next);
    },
    [],
  );

  const memoryVisible = memory.filter((m) => !excludeUids.has(m.rovas_uid));

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
          <Text style={styles.title}>{t("receipts.add_title")}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t("receipts.add_search_label")}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("receipts.add_search_placeholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {searching ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: 8 }} />
          ) : null}
          {searchError ? (
            <Text style={styles.error}>{t("receipts.add_search_error")}</Text>
          ) : null}

          {query.trim().length >= 3 && !searching && !searchError ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("receipts.add_results")}</Text>
              {results.length === 0 ? (
                <Text style={styles.hint}>{t("receipts.add_search_empty")}</Text>
              ) : (
                results.map((r) => (
                  <PersonRow
                    key={r.rovas_uid}
                    displayName={r.display_name}
                    username={r.username}
                    onAdd={() =>
                      onPick({
                        rovas_uid: r.rovas_uid,
                        username: r.username,
                        display_name: r.display_name,
                        alwaysShare: false,
                      })
                    }
                  />
                ))
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("receipts.add_memory")}</Text>
            {memoryVisible.length === 0 ? (
              <Text style={styles.hint}>{t("receipts.add_memory_empty")}</Text>
            ) : (
              memoryVisible.map((m) => (
                <View key={m.rovas_uid} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{m.display_name}</Text>
                      <Text style={styles.username}>@{m.username}</Text>
                    </View>
                    <Pressable
                      style={styles.addBtn}
                      onPress={() =>
                        onPick({
                          rovas_uid: m.rovas_uid,
                          username: m.username,
                          display_name: m.display_name,
                          alwaysShare: m.alwaysShare,
                        })
                      }
                    >
                      <Text style={styles.addBtnText}>{t("receipts.add_button")}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.toggleRow}>
                    <Switch
                      value={m.alwaysShare}
                      onValueChange={(v) => void onToggleMemoryAlways(m.rovas_uid, v)}
                      trackColor={{ false: colors.border, true: colors.brandSoft }}
                    />
                    <Text style={styles.toggleLabel}>
                      {t("receipts.split_always_short")}
                    </Text>
                  </View>
                </View>
              ))
            )}
            <Text style={styles.hint}>{t("receipts.add_memory_hint")}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PersonRow({
  displayName,
  username,
  onAdd,
}: {
  displayName: string;
  username: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>@{username}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>{t("receipts.add_button")}</Text>
        </Pressable>
      </View>
    </View>
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
  back: { color: colors.brandSoft, fontWeight: "700", width: 48 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  body: { padding: 20, gap: 10, paddingBottom: 48 },
  label: { color: colors.muted, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  section: { marginTop: 8, gap: 8 },
  sectionTitle: { fontWeight: "700", color: colors.ink, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontWeight: "600", color: colors.ink },
  username: { color: colors.muted, fontSize: 13 },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  addBtnText: { color: colors.brandSoft, fontWeight: "700", fontSize: 13 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: "600", fontSize: 13 },
});
