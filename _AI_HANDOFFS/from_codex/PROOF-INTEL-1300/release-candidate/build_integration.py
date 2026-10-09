#!/usr/bin/env python3
"""Build scoped review files from hash-pinned runtime preimages. Never deploys."""
from pathlib import Path
import hashlib, json, re, difflib

ROOT=Path(__file__).resolve().parent
PRE=ROOT/'preimages';OUT=ROOT/'candidate'
MU='wp-content/mu-plugins/'
def sha(b):return hashlib.sha256(b).hexdigest()
pins=json.loads((ROOT/'PREIMAGE_SHA256.json').read_text())
for name,digest in pins.items():assert sha((PRE/name).read_bytes())==digest,name
def read(name):return (PRE/name).read_bytes().decode()
def once(s,old,new):
    assert s.count(old)==1,(old[:100],s.count(old))
    return s.replace(old,new,1)
changed={}
def emit(name,value,before):
    p=OUT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value.encode())
    changed[name]={'preimageSha256':sha(before.encode()),'candidateSha256':sha(value.encode())}
    diff=''.join(difflib.unified_diff(before.splitlines(True),value.splitlines(True),fromfile='preimage/'+name,tofile='candidate/'+name))
    d=ROOT/'patches'/Path(name+'.diff');d.parent.mkdir(parents=True,exist_ok=True);d.write_text(diff)

name=MU+'missionmed-mr-p0.php';before=read(name);s=before
frame="        ['id'=>'mr-testimonials','division'=>'Mission Residency','eyebrow'=>'MISSION RESIDENCY · STUDENT STORIES','headline'=>'Real student stories.','connector'=>'','bridge'=>'','accent'=>'In their own words.','support'=>'“You made me fall in love with my own story and believe that my dreams are valid against all Odds.”','cta'=>'Read Full Testimonial','href'=>home_url('/testimonials/#story-marian'),'asset'=>MM_MR_P0_ASSET_URL.'/b-immersive/assets/frame-marian-aaa.jpg','visual'=>'portrait','caption'=>'Marian Ghaly · Mission Residency alumna','alt'=>'Marian Ghaly in her Mission Residency testimonial recording','theme'=>'testimonials','tone'=>'dark','width'=>300,'height'=>450],\n"
s=once(s,"function mm_mr_0929_home_hero_frames(): array {\n    $asset = MM_MR_P0_ASSET_URL . '/premium-hero/assets/';\n    return [\n","function mm_mr_0929_home_hero_frames(): array {\n    $asset = MM_MR_P0_ASSET_URL . '/premium-hero/assets/';\n    return [\n"+frame)
s=once(s,"    $evidence = $frames[4];","    $evidence = current(array_filter($frames, static fn(array $frame): bool => $frame['id'] === 'mr-ranking'));\n    $frame_count = count($frames);")
s=once(s,"' of 8: ' . $frame['division']","' of ' . $frame_count . ': ' . $frame['division']")
s=once(s,'data-tone="dark" data-theme="destination" data-visual="physician" aria-labelledby="mm-premium-hero-title"','data-tone="dark" data-theme="testimonials" data-visual="portrait" aria-labelledby="mm-premium-hero-title"')
s=once(s,'width="1277" height="473" fetchpriority="high"','width="300" height="450" fetchpriority="high"')
s=once(s,'Mission Residency, slide 1 of 8</span>','Mission Residency, slide 1 of \' . esc_html((string) $frame_count) . \'</span>')
# Alter only the MR division's primary guided destination; its existing visuals remain untouched.
s=once(s,"'cta'=>'Explore Mission Residency','href'=>home_url('/missionresidency/'),'image'","'cta'=>'Meet the Students · Explore Their Stories','href'=>home_url('/testimonials/'),'image'")
# Every prior complete frame object remains byte-identical and in order after the new frame.
old_frames=re.findall(r"^        \['id'=>.*",before,re.M)[:8]
new_frames=re.findall(r"^        \['id'=>.*",s,re.M)[:9]
assert len(old_frames)==8 and new_frames[1:]==old_frames
s=once(s,'<figcaption>Dr Marian Ghaly · Mission Residency alumna</figcaption></figure>','<figcaption>Dr Marian Ghaly · Mission Residency alumna</figcaption><a href="/testimonials/#story-marian">Read Full Testimonial</a></figure>')
s=once(s, ". mm_mr_0929_division_showcase_markup()", ". '<script defer src=\"/wp-content/mu-plugins/missionmed-proof-intelligence-assets/reader-embed.js\"></script>'\n        . mm_mr_0929_division_showcase_markup()")
emit(name,s,before)

name=MU+'missionmed-mr-0912-assets/premium-hero/hero.js';before=read(name);s=before
s=once(s,'if(frames.length!==8)return;','if(frames.length<1)return;')
s=once(s,"host.querySelector('.mm-ph__mobile-nav')","host.querySelector('.mm-ph__mobile-nav,.mm-proof-mobile-nav')")
s=once(s,'<a href="/missionresidency/">Mission Residency</a><a href="/usce/">','<a href="/missionresidency/">Mission Residency</a><a href="/testimonials/">Testimonials</a><a href="/usce/">')
emit(name,s,before)

name=MU+'missionmed-mr-0912-assets/premium-hero/hero.css';before=read(name)
extra='''
/* PROOF-INTEL-1300: new testimonial frame only; prior crop/contrast rules retained. */
.mm-ph[data-theme="testimonials"]{background:#091427}
.mm-ph[data-theme="testimonials"] .mm-ph__copy{top:clamp(130px,17vh,185px);max-width:48%}
.mm-ph[data-theme="testimonials"] .mm-ph__headline{font-size:clamp(43px,4.5vw,65px);line-height:1.06}
.mm-ph[data-theme="testimonials"] .mm-ph__support{font-size:clamp(17px,1.5vw,21px);line-height:1.65}
.mm-ph[data-theme="testimonials"] .mm-ph__visual{inset:130px 6% 90px auto;width:34%;max-width:400px;border-radius:14px;border:1px solid #c9a24b66}
.mm-ph[data-theme="testimonials"] .mm-ph__image{object-fit:cover;object-position:center;transform:none}
.mm-ph[data-theme="testimonials"] .mm-ph__caption{display:block;position:absolute;bottom:0;left:0;right:0;padding:38px 16px 16px;background:linear-gradient(transparent,#071020);color:#fff;font-size:13px}
@media(max-width:1000px) and (min-width:761px){.mm-ph__controls{gap:8px}.mm-ph__dots{flex-shrink:1}.mm-ph__dot{min-width:36px;width:36px}}
@media(max-width:760px){
 .mm-ph[data-theme="testimonials"]{height:920px}
 .mm-ph[data-theme="testimonials"] .mm-ph__visual{inset:96px auto auto 50%;transform:translateX(-50%);width:190px;height:285px;max-width:none}
 .mm-ph[data-theme="testimonials"] .mm-ph__copy{top:420px;left:24px;right:24px;max-width:none}
 .mm-ph[data-theme="testimonials"] .mm-ph__headline{font-size:clamp(34px,9vw,43px)}
 .mm-ph[data-theme="testimonials"] .mm-ph__support{font-size:16px}
 .mm-ph[data-theme="testimonials"] .mm-ph__cta::after{transform:none}
}
@media(max-width:360px){.mm-ph[data-theme="testimonials"]{height:1020px}.mm-ph[data-theme="testimonials"] .mm-ph__copy{left:16px;right:16px}}
'''
emit(name,before+extra,before)

name=MU+'missionmed-mr-alternate-assets/page.php';before=read(name);s=before
s=once(s,'<a href="/missionresidency/" class="is-active">Mission Residency</a>','<a href="/missionresidency/" class="is-active">Mission Residency</a><a href="/testimonials/">Testimonials</a>')
s=once(s,'<nav aria-label="Mobile navigation"><a href="/">MissionMed home</a>','<nav aria-label="Mobile navigation"><a href="/">MissionMed home</a><a href="/testimonials/">Testimonials</a>')
s=once(s,'<div class="mm-alt-actions"><a class="cl1403c-a-btn" href="#bootcamp">','<div class="mm-alt-actions"><a class="cl1403c-a-btn" href="/testimonials/">Start with Student Stories →</a><a class="cl1403c-a-btn mm-alt-secondary" href="#bootcamp">')
s=once(s,'<section class="mm-alt-early" aria-labelledby="early-title">','<section class="mm-alt-early mm-proof-guided" aria-labelledby="proof-guided-title"><div class="mm-alt-early-inner"><div><p class="mm-alt-kicker">Before you choose your training path</p><h2 id="proof-guided-title">Hear from the students who trained here.</h2><p>Explore written reviews and student videos, then discover the training path for you.</p></div><a href="/testimonials/">Explore Student Stories →</a></div></section>\n<section class="mm-alt-early" aria-labelledby="early-title">')
for identity in ['marian','manasa']:
    anchor='<div class="mm-human-identity"><h3 id="'+identity+'-name">'
    s=once(s,anchor,'<a class="mm-alt-proof-link" href="/testimonials/#story-'+identity+'">Read Full Testimonial</a>'+anchor)
# Latest Founder recovery: omit unsupported testimonials rather than publish an excerpt as full.
excluded = re.findall(r'<article class="mm-alt-alumnus" aria-labelledby="manasa-name">.*?</article>', s, re.S)
assert len(excluded) == 1
s = once(s, excluded[0], '')
(ROOT/'MR_SOURCE_EXCLUSION.json').write_text(json.dumps({'student':'Manasa Kandula','reason':'Complete original not authenticated in recovered primary library; preserve source privately pending reconciliation.','removedBlockSha256':sha(excluded[0].encode()),'removedBlockBytes':len(excluded[0].encode()),'sourcePath':name,'preimageSha256':sha(before.encode()),'scope':'Only exact Manasa testimonial article; all remaining MR content retained.'},indent=2)+'\n')
s=once(s,'</body>','<script defer src="/wp-content/mu-plugins/missionmed-proof-intelligence-assets/reader-embed.js"></script></body>')
emit(name,s,before)

post=json.loads(read('wordpress/post-6023.json'));before=post['post_content'];s=once(before,'89.1% Match Rate &middot; 3,000+ Trained Since 2009','Mission Residency &middot; Student Stories');nl='\r\n' if '\r\n' in s else '\n'
anchor="            '<a href=\"https://missionmedinstitute.com/usce/\" data-mm-href=\"/usce/\">USCE</a>'+"
s=once(s,anchor,"            '<a href=\"https://missionmedinstitute.com/testimonials/\" data-mm-href=\"/testimonials/\">Testimonials</a>'+"+nl+anchor)
mobile="""            '<details class="mm-proof-mobile-nav"><summary>Menu</summary><nav aria-label="Mobile navigation">'+
              '<a href="/">Home</a><a href="/examprep/">ExamPrep</a><a href="/mission-residency/">Mission Residency</a><a href="/testimonials/">Testimonials</a><a href="/usce/">USCE</a><a href="/homepage-arena/">Arena</a><a href="/member-dashboard/">My Matrix</a><a href="/my-account/">My Account</a><a href="/cart/">Cart</a>'+
            '</nav></details>'+""".replace('\n',nl)
s=once(s,"          '<div class=\"mm-l5__right\">'+","          '<div class=\"mm-l5__right\">'+"+nl+mobile)
style='''/* PROOF-INTEL-1300: retain all navigation destinations and add accessible mobile access. */
.mm-l5__nav a{padding-left:14px;padding-right:14px}
.mm-proof-mobile-nav{display:none;position:relative;color:inherit}
.mm-proof-mobile-nav summary{min-width:64px;min-height:44px;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;cursor:pointer;list-style:none}
.mm-proof-mobile-nav summary::-webkit-details-marker{display:none}
.mm-proof-mobile-nav nav{position:absolute;right:0;top:48px;width:min(260px,calc(100vw - 28px));max-height:70vh;overflow:auto;box-sizing:border-box;padding:12px 20px;display:grid;background:#091427;color:#fff;box-shadow:0 12px 30px #0004;z-index:100}
.mm-proof-mobile-nav nav a{display:flex;align-items:center;min-height:44px;color:#fff!important;text-decoration:none}
.mm-proof-mobile-nav :focus-visible{outline:3px solid #d9bd7b;outline-offset:3px}
@media(max-width:880px){.mm-proof-mobile-nav{display:block}.mm-l5__right>.mm-l5__members{display:none}.mm-l5__right{gap:8px}}
'''.replace('\n',nl)
s=once(s,'</style>',style+'</style>')
s=once(s,"    document.body.insertBefore(wrap, document.body.firstChild);","    document.body.insertBefore(wrap, document.body.firstChild);"+nl+"    var proofMenu = wrap.querySelector('.mm-proof-mobile-nav');"+nl+"    if(proofMenu){ proofMenu.addEventListener('click',function(e){if(e.target.closest('a'))proofMenu.open=false;}); proofMenu.addEventListener('keydown',function(e){if(e.key==='Escape'){proofMenu.open=false;proofMenu.querySelector('summary').focus();}}); }")
emit('wordpress/post-6023-content.html',s,before)
# Text file is an object-content candidate, NOT an executable DB update or object replacement.
(ROOT/'CANDIDATE_SHA256.json').write_text(json.dumps(changed,indent=2)+'\n')
(ROOT/'STATUS.json').write_text(json.dumps({'status':'LOCAL CANDIDATE ONLY — NOT DEPLOYED','existingHeroFramesPreserved':8,'candidateHeroFrames':9,'quotePublicationGate':'unresolved; no release authorization inferred','proofDestination':'/testimonials/','liveAssetSha256':'a48095548fac59f973930cfd247361227e021682ed49dcbc4022d830c3f00479','runtimePreimagesPinned':True},indent=2)+'\n')
print(json.dumps({'files':len(changed),'heroFrames':9,'status':'candidate-only'},indent=2))
