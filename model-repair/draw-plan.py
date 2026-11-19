import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent
rows=json.loads((root/'model-inspection.json').read_text())
scale=64;pad=70;minx=-4.05;maxy=5.9
W,H=650,830
im=Image.new('RGB',(W,H),'#f8fafc');d=ImageDraw.Draw(im)
try:
 font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',23)
 small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
except OSError:font=small=ImageFont.load_default()
def point(v):return(pad+(v[0]-minx)*scale,pad+(maxy-v[1])*scale)
colors=['#d7e9fa','#e8edf3','#f1dbcc','#d9ead9','#eadff6','#e2eaf8','#e0e2e8','#f7e9c8']
centers=[]
for r in rows:
 if not r['name'].startswith('地板'):continue
 index=len(centers);area=0;cx=cy=0
 for face in r['faces']:
  for j in range(1,len(face)-1):
   vs=[r['vertices'][i] for i in [face[0],face[j],face[j+1]]]
   if min(v[2] for v in vs)<r['max'][2]-.001:continue
   a=abs((vs[1][0]-vs[0][0])*(vs[2][1]-vs[0][1])-(vs[2][0]-vs[0][0])*(vs[1][1]-vs[0][1]))/2
   d.polygon([point(v) for v in vs],fill=colors[index]);area+=a;cx+=a*sum(v[0] for v in vs)/3;cy+=a*sum(v[1] for v in vs)/3
 centers.append((cx/area,cy/area,index+1,r['name']))
for r in rows:
 if not r['name'].startswith('立方体'):continue
 for face in r['faces']:
  for j in range(1,len(face)-1):
   vs=[r['vertices'][i] for i in [face[0],face[j],face[j+1]]];cross=[]
   for a,b in zip(vs,vs[1:]+vs[:1]):
    if(a[2]-.2)*(b[2]-.2)<0:
     t=(.2-a[2])/(b[2]-a[2]);cross.append([a[i]+t*(b[i]-a[i]) for i in range(3)])
   if len(cross)==2:d.line([point(v) for v in cross],fill='#35445c',width=4)
for x,y,n,name in centers:
 px,py=point([x,y]);d.ellipse((px-18,py-18,px+18,py+18),fill='white',outline='#6583af',width=2);d.text((px,py),str(n),font=font,fill='#203958',anchor='mm')
d.text((30,22),'ROOMLAB / FLOOR PLAN',font=font,fill='#263c5d')
d.text((30,H-37),'Numbers mark floor sections. Direction is model-relative.',font=small,fill='#607089')
im.save(root/'floor-plan.png')
print('room labels:',centers)
