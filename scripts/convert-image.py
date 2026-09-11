import sys
from pathlib import Path
from PIL import Image

source, destination = map(Path, sys.argv[1:3])
with Image.open(source) as image:
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    image.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
    image.save(destination, "WEBP", quality=82, method=6)
