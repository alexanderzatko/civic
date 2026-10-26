import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/** One-shot note after the first proof photo is attached (matches Rovas web). */
export function VolunteerPhotoPrivacyModal({ visible, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          <Text style={styles.title}>{t("volunteer.paint_note_title")}</Text>
          <Text style={styles.body}>{t("volunteer.paint_note")}</Text>
          <Text style={styles.hint}>{t("volunteer.paint_note_hint")}</Text>
          <Pressable
            style={styles.ok}
            onPress={onDismiss}
            accessibilityRole="button"
          >
            <Text style={styles.okText}>{t("volunteer.paint_note_ok")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    fontStyle: "italic",
  },
  ok: {
    marginTop: 4,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  okText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
