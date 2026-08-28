import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";
import type { VolunteerPhotoDraft } from "@/lib/pick-volunteer-photo";

type Props = {
  photos: VolunteerPhotoDraft[];
  rotatingIndex: number | null;
  disabled?: boolean;
  onRotate: (index: number) => void;
  onRemove: (index: number) => void;
};

export function VolunteerPhotoList({
  photos,
  rotatingIndex,
  disabled = false,
  onRotate,
  onRemove,
}: Props) {
  return (
    <View style={styles.list}>
      {photos.map((photo, index) => {
        const busy = rotatingIndex === index;
        const locked = disabled || (rotatingIndex !== null && !busy);

        return (
          <View key={`${photo.filename}-${index}`} style={styles.row}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.thumb}
              resizeMode="cover"
              accessibilityLabel={photo.filename}
            />
            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onRotate(index)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={t("volunteer.rotate_photo")}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <>
                    <MaterialIcons
                      name="rotate-right"
                      size={18}
                      color={colors.brand}
                    />
                    <Text style={styles.actionText}>
                      {t("volunteer.rotate_photo")}
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onRemove(index)}
                disabled={locked}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>
                  {t("volunteer.remove_photo")}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  actions: { flex: 1, gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  actionText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  removeText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
});
