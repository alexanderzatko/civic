import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { requireOptionalNativeModule } from "expo-modules-core";
import type { WorkReportPhotoInput } from "@civic/shared";

export type VolunteerPhotoDraft = WorkReportPhotoInput & {
  uri: string;
};

export type PickVolunteerPhotoResult =
  | { ok: true; photo: VolunteerPhotoDraft }
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
    if (!data || !asset.uri) {
      return { ok: false, reason: "cancelled" };
    }
    return {
      ok: true,
      photo: {
        filename: asset.fileName ?? `photo-${index + 1}.jpg`,
        mime: asset.mimeType ?? "image/jpeg",
        data,
        uri: asset.uri,
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

export async function rotateVolunteerPhoto(
  photo: VolunteerPhotoDraft,
): Promise<VolunteerPhotoDraft> {
  const format = photo.mime === "image/png" ? SaveFormat.PNG : SaveFormat.JPEG;
  const result = await manipulateAsync(
    photo.uri,
    [{ rotate: 90 }],
    { compress: 0.6, format, base64: true },
  );
  if (!result.base64) {
    throw new Error("rotation_missing_base64");
  }
  return {
    filename: photo.filename,
    mime: format === SaveFormat.PNG ? "image/png" : "image/jpeg",
    data: result.base64,
    uri: result.uri,
  };
}
