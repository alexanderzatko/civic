import type { WorkReportPhotoInput } from "@civic/shared";

export type PickVolunteerPhotoResult =
  | { ok: true; photo: WorkReportPhotoInput }
  | { ok: false; reason: "unavailable" | "denied" | "cancelled" };

/** Lazy-loads expo-image-picker so the route works without a native rebuild. */
export async function pickVolunteerPhoto(
  index: number,
): Promise<PickVolunteerPhotoResult> {
  let ImagePicker: typeof import("expo-image-picker");
  try {
    ImagePicker = await import("expo-image-picker");
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: "denied" };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) {
      return { ok: false, reason: "cancelled" };
    }

    const asset = result.assets[0];
    const data = asset.base64;
    if (!data) {
      return { ok: false, reason: "cancelled" };
    }
    return {
      ok: true,
      photo: {
        filename: asset.fileName ?? `photo-${index + 1}.jpg`,
        mime: asset.mimeType ?? "image/jpeg",
        data,
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
