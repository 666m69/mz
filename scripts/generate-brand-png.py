"""Create official MZcode PNG assets from the approved SVG logo (build-time only)."""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import cairosvg

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT / 'site/assets/images'
SVG=(ASSETS/'mz-mark.svg').read_bytes()

for size,name in [(192,'icon-192.png'),(512,'icon-512.png')]:
    cairosvg.svg2png(bytestring=SVG,write_to=str(ASSETS/name),output_width=size,output_height=size)

W,H=1200,630
image=Image.new('RGBA',(W,H),'#0B0F1A')
glow=Image.new('RGBA',(W,H))
brush=ImageDraw.Draw(glow)
brush.ellipse((-420,-400,640,640),fill=(226,140,24,95))
brush.ellipse((570,120,1400,890),fill=(121,42,213,105))
image=Image.alpha_composite(image,glow.filter(ImageFilter.GaussianBlur(95)))
draw=ImageDraw.Draw(image)
draw.rounded_rectangle((82,93,1117,538),radius=45,fill=(14,18,34,230),outline=(118,85,169,210),width=4)
icon=Image.open(BytesIO(cairosvg.svg2png(bytestring=SVG,output_width=350,output_height=350))).convert('RGBA')
image.alpha_composite(icon,(120,140))
draw=ImageDraw.Draw(image)
try:
    font=ImageFont.truetype('DejaVuSans-Bold.ttf',97)
    caption=ImageFont.truetype('DejaVuSans.ttf',34)
except OSError:
    font=ImageFont.load_default()
    caption=font
draw.text((510,165),'MZ',font=font,fill='#F9A825')
draw.text((685,165),'code',font=font,fill='#F5F7FA')
draw.rounded_rectangle((519,312,1047,316),radius=2,fill='#8A2BE2')
draw.text((520,367),'TECHNOLOGY BEYOND LIMITS',font=caption,fill='#BBC5D5')
image.convert('RGB').save(ASSETS/'mz-share.png',optimize=True)
print('Official brand PNGs ready')
