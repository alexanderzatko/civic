import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { WorkReportPhotoInput } from "@civic/shared";

export type PickVolunteerPhotoResult =
  | { ok: true; photo: WorkReportPhotoInput }
  | {
      ok: false;
      reason: "unavailable" | "denied" | "cancelled" | "error";
      message?: string;
    };

/** True when the native ExponentImagePicker module is registered in this app binary. */
export function volunteerPhotoPickerAvailable(): boolean {
  return requireOptionalNativeModule("ExponentImagePicker") != null;
}

function isNativeModuleError(message: string): boolean {
  return (
    message.includes("Cannot find native module") ||
    message.includes("UnavailabilityError") ||
    message.includes("ExponentImagePicker")
  );
}

export async function pickVolunteerPhoto(
  index: number,
): Promise<PickVolunteerPhotoResult> {
  if (!volunteerPhotoPickerAvailable()) {
    if (__DEV__) {
      console.warn(
        "[volunteer] ExponentImagePicker is not registered in this app binary",
      );
    }
    return { ok: false, reason: "unavailable" };
  }

  try {
    // iOS 14+ PHPicker does not require photo-library permission beforehand.
    if (Platform.OS !== "ios") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return { ok: false, reason: "denied" };
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.error("[volunteer] launchImageLibraryAsync failed", err);
    }
    if (isNativeModuleError(message)) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "error", message };
  }
}
