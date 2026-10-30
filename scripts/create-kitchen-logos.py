"""Create square kitchen marks that match Menúu's existing kitchen badges."""

from pathlib import Path
from math import pi, sin
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SCALE = 12
GREEN = '#075338'
CREAM = '#FFFAF2'
ORANGE = '#FB6418'
ORANGE_SOFT = '#FFD4A3'
PEACH = '#FFDDBE'


def xy(*values):
    return tuple(round(value * SCALE) for value in values)


def canvas(background):
    image = Image.new('RGBA', xy(96, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(xy(0, 0, 96, 96), radius=xy(26)[0], fill=background)
    return image, draw


# Doña Betina: a home-cook's apron with a small warm pocket.
betina, draw = canvas(GREEN)
draw.polygon([xy(30, 28), xy(40, 28), xy(41, 38), xy(55, 38), xy(56, 28),
              xy(66, 28), xy(75, 75), xy(70, 81), xy(26, 81), xy(21, 75)], fill=CREAM)
draw.rounded_rectangle(xy(37, 49, 59, 68), radius=xy(5)[0], fill=ORANGE)
draw.arc(xy(38, 21, 58, 42), start=180, end=360, fill=ORANGE_SOFT, width=xy(5)[0])
draw.line([xy(23, 54), xy(14, 57)], fill=ORANGE_SOFT, width=xy(4)[0], joint='curve')
draw.line([xy(73, 54), xy(82, 57)], fill=ORANGE_SOFT, width=xy(4)[0], joint='curve')
betina.resize((1024, 1024), Image.Resampling.LANCZOS).save(ROOT / 'dona-betina-logo.png', optimize=True)

# Almuerza con Meli: a serving cloche, distinct from the existing pot and bowl marks.
meli, draw = canvas(PEACH)
for cx in (34, 48, 62):
    points = [xy(cx + 2 * sin(2 * pi * n / 80), 31 - 15 * n / 80) for n in range(81)]
    draw.line(points, fill=ORANGE, width=xy(3)[0], joint='curve')
draw.ellipse(xy(43, 31, 53, 41), fill=ORANGE)
draw.pieslice(xy(18, 37, 78, 93), start=180, end=360, fill=GREEN)
draw.rounded_rectangle(xy(15, 66, 81, 73), radius=xy(3)[0], fill=GREEN)
draw.rounded_rectangle(xy(30, 78, 66, 83), radius=xy(2)[0], fill=ORANGE)
meli.resize((1024, 1024), Image.Resampling.LANCZOS).save(ROOT / 'almuerza-con-meli-logo.png', optimize=True)
