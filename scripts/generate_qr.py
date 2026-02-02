import qrcode
from PIL import Image

# URL設定
url = "https://tacfurniture2026-bit.github.io/tac-production/"

# QRコード生成
qr = qrcode.QRCode(
    version=4,  # サイズ（1-40）
    error_correction=qrcode.constants.ERROR_CORRECT_M, # 誤り訂正レベル（M:15%）
    box_size=20, # 1マスのピクセル数（大きくする）
    border=8,    # 余白（標準は4だが、読み取りやすく8にする）
)

qr.add_data(url)
qr.make(fit=True)

# 画像作成
img = qr.make_image(fill_color="black", back_color="white")

# 保存
output_path = "docs/qrcode_system_official.png"
img.save(output_path)

print(f"QR Code generated at: {output_path}")
