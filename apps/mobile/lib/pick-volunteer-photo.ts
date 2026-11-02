import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
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

/** WebView canvas + Rovas uploads need JPEG/PNG/WebP — not HEIC/HEIF. */
function needsJpegTranscode(
  mime: string | null | undefined,
  fileName: string | null | undefined,
  uri: string,
  hasBase64: boolean,
): boolean {
  if (!hasBase64) return true;
  const m = (mime ?? "").toLowerCase();
  if (
    m === "image/jpeg" ||
    m === "image/jpg" ||
    m === "image/png" ||
    m === "image/webp"
  ) {
    return false;
  }
  const name = `${fileName ?? ""} ${uri}`.toLowerCase();
  if (
    name.includes(".jpg") ||
    name.includes(".jpeg") ||
    name.includes(".png") ||
    name.includes(".webp")
  ) {
    // Mime missing/odd but extension is WebView-safe — keep picker bytes.
    if (!m.includes("heic") && !m.includes("heif")) return false;
  }
  // HEIC/HEIF or unknown — re-encode to JPEG for the paint WebView.
  return true;
}

async function toJpegDraft(
  uri: string,
  index: number,
  fileName?: string | null,
): Promise<VolunteerPhotoDraft> {
  const result = await manipulateAsync(uri, [], {
    compress: 0.6,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) {
    throw new Error("transcode_missing_base64");
  }
  const base =
    (fileName ?? `photo-${index + 1}`).replace(/\.[^.]+$/, "") ||
    `photo-${index + 1}`;
  return {
    filename: `${base}.jpg`,
    mime: "image/jpeg",
    data: result.base64,
    uri: result.uri,
  };
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
    if (!asset.uri) {
      return { ok: false, reason: "cancelled" };
    }

    // iOS Camera Roll is often HEIC. RN <Image> can show it via the asset URI,
    // but the paint WebView cannot — and saving HEIC bytes as .jpg fails to load.
    if (
      needsJpegTranscode(
        asset.mimeType,
        asset.fileName,
        asset.uri,
        Boolean(asset.base64),
      )
    ) {
      return {
        ok: true,
        photo: await toJpegDraft(asset.uri, index, asset.fileName),
      };
    }

    return {
      ok: true,
      photo: {
        filename: asset.fileName ?? `photo-${index + 1}.jpg`,
        mime: asset.mimeType ?? "image/jpeg",
        data: asset.base64!,
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

/**
 * Ensure paint WebView gets JPEG/PNG/WebP bytes (re-encode HEIC drafts already
 * sitting in form state from before pick-time transcode).
 */
export async function ensurePaintableVolunteerPhoto(
  photo: VolunteerPhotoDraft,
): Promise<VolunteerPhotoDraft> {
  if (
    !needsJpegTranscode(photo.mime, photo.filename, photo.uri, Boolean(photo.data))
  ) {
    return photo;
  }
  return toJpegDraft(photo.uri, 0, photo.filename);
}

/** Persist painted JPEG bytes and return a draft ready for upload + thumbnail. */
export async function applyPaintedVolunteerPhoto(
  photo: VolunteerPhotoDraft,
  paintedBase64: string,
): Promise<VolunteerPhotoDraft> {
  const path = `${FileSystem.cacheDirectory}volunteer-paint-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(path, paintedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const base = photo.filename.replace(/\.[^.]+$/, "") || "photo";
  return {
    filename: `${base}-painted.jpg`,
    mime: "image/jpeg",
    data: paintedBase64,
    uri: path,
  };
}

