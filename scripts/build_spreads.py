"""Build final A4 sketchbook spreads without redrawing Claire's artwork."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "assets/source/blank-book.png"
FINAL = ROOT / "assets/final"
OUTPUT = ROOT / "assets/spreads"
SIZE = (1280, 720)
BOOK_SIZE = (1008, 713)  # two A4 portrait leaves: width / height ~= sqrt(2)
BOOK_OFFSET = (91, 3)    # source fold x=610 lands exactly on animation hinge x=640

SPREADS = [
    ("01.jpeg", "02.jpeg"),
    ("03.jpeg", "04.jpeg"),
    ("05.jpeg", "06.jpeg"),
    ("07.jpeg", "08.jpeg"),
]

# Slightly bowed trapezoids keep every source pixel but make the sheets follow
# the photographed page curl. Both retain the exact A4 367:519 content ratio.
LEFT_QUAD = [(257, 55), (624, 62), (624, 568), (257, 574)]
RIGHT_QUAD = [(659, 62), (1026, 55), (1026, 574), (659, 568)]


def paper_colour(image: Image.Image) -> tuple[int, int, int]:
    """Robustly sample the light paper, excluding charcoal and ink."""
    rgb = np.asarray(image.convert("RGB"))
    luminance = rgb.mean(axis=2)
    pixels = rgb[luminance > np.percentile(luminance, 58)]
    return tuple(int(value) for value in np.median(pixels, axis=0))


def smoothstep(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def correct_paper(image: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    """Even the photographed paper without bleaching pencil or ink marks.

    A broad polynomial models only the palest parts of each scan. Its colour
    cast and uneven lighting are corrected toward one shared paper stock, with
    the correction fading away over dark artwork.
    """
    rgb = np.asarray(image.convert("RGB")).astype(np.float32)
    height, width = rgb.shape[:2]
    luminance = rgb.mean(axis=2)
    paper_mask = luminance > np.percentile(luminance, 58)

    yy, xx = np.mgrid[-1:1:complex(height), -1:1:complex(width)]
    basis = np.stack(
        [np.ones_like(xx), xx, yy, xx * yy, xx * xx, yy * yy], axis=2
    )
    samples = np.flatnonzero(paper_mask.ravel())[::12]
    design = basis.reshape(-1, 6)[samples]
    field = np.empty_like(rgb)
    for channel in range(3):
        values = rgb[:, :, channel].ravel()[samples]
        coefficients = np.linalg.lstsq(design, values, rcond=None)[0]
        field[:, :, channel] = basis @ coefficients

    desired = np.asarray(target, dtype=np.float32)[None, None, :]
    correction = np.clip(desired - field, -34, 34)
    # Paper receives the full correction; graphite and ink receive very little.
    paper_weight = smoothstep((luminance - 88) / 126)[:, :, None]
    corrected = rgb + correction * paper_weight
    return Image.fromarray(np.clip(corrected, 0, 255).astype(np.uint8), "RGB")


def tint_book_pages(book: Image.Image, left: tuple[int, int, int], right: tuple[int, int, int]) -> Image.Image:
    """Recolour only pale paper while retaining the photographed grain."""
    array = np.asarray(book.convert("RGBA")).copy()
    rgb = array[:, :, :3].astype(np.float32)
    alpha = array[:, :, 3]
    light = rgb.mean(axis=2)
    paper = (alpha > 12) & (light > 150)
    split = round((640 - BOOK_OFFSET[0]) / BOOK_SIZE[0] * book.width)

    for x0, x1, colour in ((0, split, left), (split, book.width, right)):
        region = paper[:, x0:x1]
        region_light = light[:, x0:x1]
        target = np.array(colour, dtype=np.float32)
        source_luma = max(float(np.median(region_light[region])), 1)
        textured = target[None, None, :] * (region_light[:, :, None] / source_luma)
        current = rgb[:, x0:x1]
        current[region] = np.clip(textured[region], 0, 255)
        rgb[:, x0:x1] = current

    array[:, :, :3] = rgb.astype(np.uint8)
    return Image.fromarray(array, "RGBA")


def perspective_coefficients(destination, source):
    """Return Pillow output-to-input perspective coefficients."""
    matrix = []
    vector = []
    for (x, y), (u, v) in zip(destination, source):
        matrix.extend([
            [x, y, 1, 0, 0, 0, -u * x, -u * y],
            [0, 0, 0, x, y, 1, -v * x, -v * y],
        ])
        vector.extend([u, v])
    return np.linalg.solve(np.asarray(matrix), np.asarray(vector))


def warped_page(image: Image.Image, quad, side: str) -> Image.Image:
    """Map a complete A4 scan onto a gently bowed notebook leaf."""
    source = ImageOps.fit(image.convert("RGBA"), (367, 519), Image.Resampling.LANCZOS)
    source_array = np.asarray(source).copy()
    source_light = source_array[:, :, :3].mean(axis=2)
    height, width = source_light.shape
    yy, xx = np.mgrid[:height, :width]
    distance = np.minimum.reduce([xx, width - 1 - xx, yy, height - 1 - yy])
    edge_feather = smoothstep(distance / 22)
    # Pale scan paper dissolves into the notebook leaf, while any drawing that
    # reaches an edge remains opaque and crisp.
    ink_strength = smoothstep((188 - source_light) / 92)
    source_alpha = ink_strength + (1 - ink_strength) * edge_feather
    source_array[:, :, 3] = np.clip(source_alpha * 255, 0, 255).astype(np.uint8)
    source = Image.fromarray(source_array, "RGBA")
    source_points = [(0, 0), (366, 0), (366, 518), (0, 518)]
    coeffs = perspective_coefficients(quad, source_points)
    warped = source.transform(
        SIZE,
        Image.Transform.PERSPECTIVE,
        coeffs,
        resample=Image.Resampling.BICUBIC,
    )

    # Lighting follows the bend: a soft trough at the binding and a faint
    # highlight toward the outer edge. This changes illumination only; it does
    # not invent or repaint any mark in the scan.
    array = np.asarray(warped).copy().astype(np.float32)
    alpha = array[:, :, 3] / 255
    xs = np.linspace(0, 1, SIZE[0])[None, :]
    if side == "left":
        inner = np.clip((xs - .42) / .08, 0, 1)
        outer = np.clip((.30 - xs) / .12, 0, 1)
    else:
        inner = np.clip((.58 - xs) / .08, 0, 1)
        outer = np.clip((xs - .70) / .12, 0, 1)
    light = 1 - .105 * inner + .025 * outer
    array[:, :, :3] *= light[:, :, None]
    array[:, :, 3] = alpha * 255
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGBA")


def build_cover_back(images: list[Image.Image]) -> None:
    """Create the inside-cover paper from the actual supplied paper stock."""
    colours = np.asarray([paper_colour(image) for image in images])
    colour = tuple(int(value) for value in np.median(colours, axis=0))
    width, height = images[0].size
    rng = np.random.default_rng(1913)
    noise = rng.normal(0, 2.2, (height, width, 1))
    base = np.asarray(colour, dtype=np.float32)[None, None, :] + noise
    texture = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")
    texture = texture.filter(ImageFilter.GaussianBlur(.32))
    texture.save(ROOT / "assets/source/cover-back.png", optimize=True)


def build() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw_scans = {path.name: Image.open(path).convert("RGB") for path in sorted(FINAL.glob("*.jpeg"))}
    colours = np.asarray([paper_colour(image) for image in raw_scans.values()])
    canonical_paper = tuple(int(value) for value in np.median(colours, axis=0))
    scans = {
        name: correct_paper(image, canonical_paper)
        for name, image in raw_scans.items()
    }
    build_cover_back(list(scans.values()))

    blank = Image.open(TEMPLATE).convert("RGBA").resize(BOOK_SIZE, Image.Resampling.LANCZOS)

    for number, (left_name, right_name) in enumerate(SPREADS, start=1):
        left_scan, right_scan = scans[left_name], scans[right_name]
        spread = Image.new("RGBA", SIZE, (255, 255, 255, 0))
        book = tint_book_pages(blank, canonical_paper, canonical_paper)
        spread.alpha_composite(book, BOOK_OFFSET)
        spread.alpha_composite(warped_page(left_scan, LEFT_QUAD, "left"))
        spread.alpha_composite(warped_page(right_scan, RIGHT_QUAD, "right"))
        spread.save(OUTPUT / f"spread-{number:02d}.png", optimize=True)


if __name__ == "__main__":
    build()
