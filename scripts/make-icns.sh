#!/bin/bash
# icon.png から icon.icns を生成するスクリプト
# macOS 標準の sips + iconutil を使用する
# 使い方: bash scripts/make-icns.sh

set -e

# スクリプトのある場所からプロジェクトルートを基準にする
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SRC_PNG="$PROJECT_ROOT/assets/icons/icon.png"
ICONSET_DIR="$PROJECT_ROOT/assets/icons/icon.iconset"
OUTPUT_ICNS="$PROJECT_ROOT/assets/icons/icon.icns"

# 入力ファイルの存在確認
if [ ! -f "$SRC_PNG" ]; then
  echo "エラー: $SRC_PNG が見つかりません。" >&2
  exit 1
fi

# iconsetディレクトリを作成（既存の場合は一旦クリア）
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

echo "iconsetを生成中..."

# macOSが要求する各サイズを sips でリサイズして出力する
sips -z 16   16   "$SRC_PNG" --out "$ICONSET_DIR/icon_16x16.png"      > /dev/null
sips -z 32   32   "$SRC_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png"   > /dev/null
sips -z 32   32   "$SRC_PNG" --out "$ICONSET_DIR/icon_32x32.png"      > /dev/null
sips -z 64   64   "$SRC_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png"   > /dev/null
sips -z 128  128  "$SRC_PNG" --out "$ICONSET_DIR/icon_128x128.png"    > /dev/null
sips -z 256  256  "$SRC_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null
sips -z 256  256  "$SRC_PNG" --out "$ICONSET_DIR/icon_256x256.png"    > /dev/null
sips -z 512  512  "$SRC_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null
sips -z 512  512  "$SRC_PNG" --out "$ICONSET_DIR/icon_512x512.png"    > /dev/null
sips -z 1024 1024 "$SRC_PNG" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null

echo "icon.icns を生成中..."

# iconutil で iconset → icns に変換
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

# 作業用の iconset ディレクトリを削除（生成物は icns のみ残す）
rm -rf "$ICONSET_DIR"

echo "完了: $OUTPUT_ICNS"
