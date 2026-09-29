"""Render the boot splash at 1x (1280x800 screens) and 2x (Retina 2560x1600).
Plymouth scales images with nearest-neighbour, which looks broken, so we ship
ready-sized images and never scale on the device."""
from PIL import Image, ImageDraw, ImageFont

NAVY = (42, 43, 77, 255)
ORANGE = (234, 104, 66, 255)
SLATE = (97, 122, 137, 255)
K = 3  # supersampling factor for the master render
REPO = '/home/claude/kiosk-os'


def font(path, size, weight):
    f = ImageFont.truetype(path, size * K)
    f.set_variation_by_axes([weight])
    return f


W, H = 1600 * K, 1200 * K
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
logo = Image.open(f'{REPO}/assets/logo.png').convert('RGBA').resize((340 * K, 340 * K), Image.LANCZOS)
im.alpha_composite(logo, ((W - 340 * K) // 2, 40 * K))


def center(text, f, y, fill, track=0):
    y *= K
    if track:
        widths = [d.textlength(c, font=f) for c in text]
        total = sum(widths) + track * K * (len(text) - 1)
        x = (W - total) / 2
        for c, w in zip(text, widths):
            d.text((x, y), c, font=f, fill=fill)
            x += w + track * K
        return total
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)
    return w


center('Innovation IT Hub', font('/tmp/j.ttf', 84, 620), 440, NAVY)
w = center('AHMED MORTADA', font('/tmp/j.ttf', 34, 500), 565, SLATE, track=6)
y, gap, L = 589 * K, 28 * K, 70 * K
d.rounded_rectangle(((W - w) / 2 - gap - L, y - 2 * K, (W - w) / 2 - gap, y + 2 * K), 2 * K, fill=ORANGE)
d.rounded_rectangle(((W + w) / 2 + gap, y - 2 * K, (W + w) / 2 + gap + L, y + 2 * K), 2 * K, fill=ORANGE)
fq, fqb = font('/tmp/ji.ttf', 40, 400), font('/tmp/ji.ttf', 40, 650)
center('“Every great journey begins with one word:', fq, 700, NAVY)
a, b = 'Read', '.”'
wa, wb = d.textlength(a, font=fqb), d.textlength(b, font=fq)
x = (W - wa - wb) / 2
d.text((x, 758 * K), a, font=fqb, fill=ORANGE)
d.text((x + wa, 758 * K), b, font=fq, fill=NAVY)
center('for Youssef & Farida', font('/tmp/ji.ttf', 28, 450), 850, SLATE)

im = im.crop(im.getbbox())
pad = 20 * K
master = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
master.alpha_composite(im, (pad, pad))

out = f'{REPO}/plymouth/kioskos'
for name, height in (('splash.png', 520), ('splash-2x.png', 1040)):
    width = round(master.width * height / master.height)
    master.resize((width, height), Image.LANCZOS).save(f'{out}/{name}', optimize=True)
    print(name, width, height)

for name, size in (('dot.png', 12), ('dot-2x.png', 24)):
    big = Image.new('RGBA', (size * 8, size * 8), (0, 0, 0, 0))
    ImageDraw.Draw(big).ellipse((0, 0, size * 8 - 1, size * 8 - 1), fill=ORANGE)
    big.resize((size, size), Image.LANCZOS).save(f'{out}/{name}')

# preview at Retina size, scaled down for viewing
pv = Image.new('RGBA', (2560, 1600), (255, 255, 255, 255))
s = Image.open(f'{out}/splash-2x.png')
top = int(1600 / 2 - s.height / 2 - 1600 * 0.04)
pv.alpha_composite(s, ((2560 - s.width) // 2, top))
dot = Image.open(f'{out}/dot-2x.png')
dy = min(int(1600 * 0.88), top + s.height + 72)
for i, o in enumerate((255, 150, 60)):
    dd = dot.copy()
    dd.putalpha(dd.getchannel('A').point(lambda v, o=o: v * o // 255))
    pv.alpha_composite(dd, (2560 // 2 - 36 + i * 48 - 12, dy))
pv.resize((1280, 800), Image.LANCZOS).convert('RGB').save('/home/claude/boot-screen-preview.png')
