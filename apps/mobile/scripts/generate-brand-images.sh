#!/usr/bin/env bash
# Regenerate app icon / splash PNGs from identity/*.svg.
# Icons keep ME_logo_plain aspect ratio (width-limited resize, centered on canvas).
# Splash uses ME_logo (framed M) on a transparent PNG; green comes from app.json.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(cd ../.. && pwd)"
IDENTITY="${ROOT}/identity"
ASSETS="assets/images"
BRAND="#0B3D2E"
# ~66% of 1024 — adaptive-icon safe zone; height follows SVG aspect ratio.
ICON_LOGO_W=676
SPLASH_LOGO_W=512
FAVICON_LOGO_W=32
MONOCHROME_LOGO_W=169

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required." >&2
  exit 1
fi

echo "Preparing cropped SVG sources…"
python3 <<'PY'
import re
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
IDENTITY = Path(__file__).resolve().parents[2] / "identity"


def path_numbers(d: str) -> list[float]:
    return [float(x) for x in re.findall(r"-?\d+\.?\d*", d)]


def visible_plain(el) -> bool:
    d = el.get("points") or el.get("d", "")
    nums = path_numbers(d)
    return bool(nums) and max(abs(n) for n in nums) < 200


def write_svg(root, out: Path) -> None:
    for el in list(root):
        if el.tag.split("}")[-1] == "style":
            root.remove(el)
    tree = ET.ElementTree(root)
    tree.write(out, encoding="utf-8", xml_declaration=True)


def prep_me_logo() -> None:
    src = IDENTITY / "ME_logo.svg"
    tree = ET.parse(src)
    root = tree.getroot()
    root.set("viewBox", "239 272 134 104")
    root.set("style", "enable-background:new 239 272 134 104;")
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag == "path" and el.get("class") == "st1":
            if len(el.get("d", "")) < 80:
                for parent in root.iter():
                    if el in list(parent):
                        parent.remove(el)
                        break
        if tag in ("path", "polygon"):
            el.attrib.pop("class", None)
            el.set("fill", "#FFFFFF")
    write_svg(root, IDENTITY / "ME_logo_cropped_white.svg")


def prep_me_logo_plain() -> None:
    src = IDENTITY / "ME_logo_plain.svg"
    tree = ET.parse(src)
    root = tree.getroot()
    root.set("viewBox", "0 0 135.2 102.9")
    root.set("style", "enable-background:new 0 0 135.2 102.9;")
    for el in list(root):
        tag = el.tag.split("}")[-1]
        if tag in ("path", "polygon") and not visible_plain(el):
            root.remove(el)
        elif tag in ("path", "polygon"):
            el.set("fill", "#FFFFFF")
    write_svg(root, IDENTITY / "ME_logo_plain_white.svg")


prep_me_logo()
prep_me_logo_plain()
print("  identity/ME_logo_cropped_white.svg")
print("  identity/ME_logo_plain_white.svg")
PY

ME_LOGO="${IDENTITY}/ME_logo_cropped_white.svg"
ME_PLAIN="${IDENTITY}/ME_logo_plain_white.svg"
DENSITY=384

center_logo() {
  local src="$1" width="$2" out="$3"
  magick -size 1024x1024 xc:none \
    \( "${src}" -background none -density "${DENSITY}" -resize "${width}x" \) \
    -gravity center -composite "${out}"
}

mkdir -p "${ASSETS}"

echo "Generating app icons (ME_logo_plain, aspect ratio preserved)…"
center_logo "${ME_PLAIN}" "${ICON_LOGO_W}" "${ASSETS}/icon.png"
cp "${ASSETS}/icon.png" "${ASSETS}/android-icon-foreground.png"

magick -size 1024x1024 xc:"${BRAND}" "${ASSETS}/android-icon-background.png"

magick -size 256x256 xc:none \
  \( "${ME_PLAIN}" -background none -density "${DENSITY}" -resize "${MONOCHROME_LOGO_W}x" \) \
  -gravity center -composite "${ASSETS}/android-icon-monochrome.png"

magick -size 48x48 xc:"${BRAND}" \
  \( "${ME_PLAIN}" -background none -density "${DENSITY}" -resize "${FAVICON_LOGO_W}x" \) \
  -gravity center -composite "${ASSETS}/favicon.png"

echo "Generating splash image (ME_logo, transparent, aspect ratio preserved)…"
magick "${ME_LOGO}" -background none -density "${DENSITY}" -resize "${SPLASH_LOGO_W}x" "${ASSETS}/splash-icon.png"

echo "Done. Re-run native prebuild after changing these assets:"
echo "  iOS:   pnpm --filter @civic/mobile ios:device:clean"
echo "  Android: pnpm --filter @civic/mobile android:apk:clean"
