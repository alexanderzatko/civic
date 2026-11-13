import { Platform } from "react-native";
import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { requireOptionalNativeModule } from "expo-modules-core";

export type PickReceiptQrResult =
  | { ok: true; data: string }
  | {
      ok: false;
      reason: "unavailable" | "denied" | "cancelled" | "no_qr" | "error";
      message?: string;
    };

/** True when the native ExponentImagePicker module is registered in this app binary. */
export function receiptQrPickerAvailable(): boolean {
  return requireOptionalNativeModule("ExponentImagePicker") != null;
}

function isNativeModuleError(message: string): boolean {
  return (
    message.includes("Cannot find native module") ||
    message.includes("UnavailabilityError") ||
    message.includes("ExponentImagePicker") ||
    message.includes("ExponentCamera")
  );
}

/**
 * Pick a photo from the gallery and decode a QR code (e.g. eKasa receipt screenshot).
 */
export async function pickReceiptQrFromGallery(): Promise<PickReceiptQrResult> {
  if (!receiptQrPickerAvailable()) {
    if (__DEV__) {
      console.warn(
        "[receipts] ExponentImagePicker is not registered in this app binary",
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
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return { ok: false, reason: "cancelled" };
    }

    const codes = await scanFromURLAsync(result.assets[0].uri, ["qr"]);
    const data = codes[0]?.data?.trim();
    if (!data) {
      return { ok: false, reason: "no_qr" };
    }
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.error("[receipts] pickReceiptQrFromGallery failed", err);
    }
    if (isNativeModuleError(message)) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "error", message };
  }
}
