"""Founder-review research ledger. Ratings stay out of the web bundle.
All Amazon observations came from exact listing pages in the browser on 2026-10-03 UTC.
This is a manual curation source, not an Amazon scraper or an authorized API cache.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
rows=[
('B0CW1S7XP5','Elgato Facecam MK.2',4.3,1591,'00:36','owner-exception'),
('B0CTJ7PVN1','Shure MV7+',4.7,1107,'00:37:19.498','include'),
('B0002E4Z8M','Shure SM7B',4.8,12198,'00:37:25.311','include'),
('B0CCSVYWMH','Shure SM7dB',4.4,964,'00:37:30.957','hold'),
('B0BQM4TKF7','RØDE PodMic USB',4.2,1303,'00:39:20.106','hold'),
('B085TFF7M1','Logitech C920x HD Pro',4.6,22025,'00:40:05.745','include'),
('B09NBWWP79','Logitech Brio Ultra 4K',4.5,1311,'00:40:12.376','include'),
('B0BFJ4CRKD','Logitech MX Brio',4.4,1479,'00:40:18.065','hold'),
('B07L755X9G','Elgato Key Light',4.5,4303,'00:41:07.014','include'),
('B0GYDFGCCQ','Elgato Key Light Air MK.2',3.8,14,'00:41:12.868','hold'),
('B097QZGRCQ','Logitech Litra Glow',4.5,3402,'00:41:18.279','include'),
('B09738CV2G','Elgato Stream Deck MK.2',4.8,10363,'00:50:43.918','include'),
('B0BJL8SJ59','Elgato Stream Deck +',4.6,4613,'00:50:46.694','include'),
('B0CVY4566H','Elgato Stream Deck Neo',4.6,1338,'00:50:50.527','include'),
('B0D92VDW76','Sony ZV-E10 II + 16–50mm kit',4.0,270,'00:56:55.197','hold'),
('B0CG19QXWD','DJI Osmo Pocket 3',4.5,10545,'00:57:00.641','include'),
('B0BTTV6CT1','Canon EOS R50 + RF-S 18–45mm kit',4.5,1643,'00:57:22.847','include'),
('B0B527QM4X','Nikon Z30 + 16–50mm kit',4.4,242,'00:57:45.471','hold'),
('B07FKG8PGZ','Samson Q2U recording pack (black)',4.6,1046,'00:58:06.828','include'),
('B00N1YPXW2','Blue Yeti USB (Blackout)',4.6,57093,'00:58:10.110','include'),
('B09KN3FMY7','BAGSMART compression packing cubes, 6-piece, BM0104003AN',4.5,13524,'00:59:13.685','include'),
('B09VPHVT2Z','Anker 737 24K 140W',4.4,17598,'00:59:34.981','hold'),
('B01M0A3BKH','Samsonite Freeform 21-inch spinner (black)',4.3,19262,'01:00:08.106','hold'),
('B0DCBB2YTR','Anker A1695 25K 165W',4.4,12349,'01:00:12.096','hold'),
('B0C4WC8QJR','Tide to Go pens, 3 count',4.7,10112,'01:01:50.705','include'),
('B07BL7JXHV','Travelpro Maxlite 5 21-inch spinner (black)',4.4,12559,'01:02:10.523','hold'),
('B07K3FN5MR','Elgato Cam Link 4K',4.6,14007,'01:02:36.201','include'),
('B097376LKF','Elgato Wave Mic Arm LP',4.6,5020,'01:02:51.207','include'),
('B0CVYHHPX6','Elgato Wave Neo',4.3,423,'01:02:55.401','hold'),
('B014VBGUCA','Amazon Essentials packing cubes, 4 piece, black',4.7,43703,'01:03:17.691','include'),
('B004HMRQF4','Samsill Professional Padfolio, faux leather, letter size, black',4.7,5387,'01:03:40.618','include'),
('B08CK9X9Z8','Anker PowerExpand A8313 USB-C to Gigabit Ethernet',4.8,6589,'01:04:41.197','include')]
ledger=[dict(asin=a,model=n,rating=r,ratingCount=c,observedAt='2026-10-03T'+t+'Z',availability='In Stock',decision=d,url='https://www.amazon.com/dp/'+a) for a,n,r,c,t,d in rows]
(ROOT/'evidence/amazon-observations.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
names={r['asin']:r['model'] for r in ledger}
spec={
'logi':'https://www.logitech.com/en-gb/products/webcams/brio-4k-hdr-webcam.html',
'q2u':'https://samsontech.com/products/microphones/usb-microphones/q2u/',
'mv7':'https://pubs.shure.com/view/guide/MV7plus/en-US.pdf',
'sm7':'https://service.shure.com/articles/en_US/Knowledge/sm7-output-level-and-preamp-gain-specifications',
'key':'https://help.elgato.com/hc/en-us/articles/360028244011-Key-Light-Quick-Start-Guide',
'canon':'https://cam.start.canon/en/C011/manual/html/UG-11_Reference_0090.html',
'dji':'https://dl.djicdn.com/downloads/DJI_Osmo_Pocket_3/UM/20250826/DJI_Osmo_Pocket_3_User_Manual_v1.0_en.pdf',
'arm':'https://help.elgato.com/hc/en-us/articles/4404864561421-Wave-Mic-Arm-LP-Specifications',
'tide':'https://tide.com/en-us/shop/type/stain-remover/tide-to-go',
'samsill':'https://shop.samsill.com/collections/padfolios',
'cubes':'https://www.bagsmart.com/products/blast-packing-cubes',
'camlink':'https://www.elgato.com/us/en/p/cam-link-4k',
'stream':'https://www.elgato.com/us/en/p/stream-deck-mk2',
'litra':'https://www.logitech.com/en-us/products/lighting/litra-glow.html',
'ethernet':'https://service.anker.com/product-description/a085g000004x2CtAAI/powerexpand-usbc-to-gigabit-ethernet-adapter',
'facecam':'https://www.elgato.com/us/en/p/facecam-mk2',
'yeti':'https://www.logitechg.com/en-us/products/streaming-gear/yeti-premium-usb-microphone.html'}
reviews={
'canon':dict(by='DPReview',title='EOS R50 · autofocus, video and lens limitations',url='https://www.dpreview.com/reviews/6952765962/canon-eos-r50-review-compact-capable-but-lacking-for-lenses/'),
'neo':dict(by='Tom’s Hardware',title='Stream Deck Neo · hands-on workflow review',url='https://www.tomshardware.com/peripherals/elgato-stream-deck-neo-review'),
'plus':dict(by='EposVox',title='Stream Deck + · dials, control and limitations',url='https://www.youtube.com/watch?v=vvoTpcHr_X4',video='vvoTpcHr_X4'),
'cubes':dict(by='Pack Hacker',title='Blast compression cubes · packing and build tradeoffs',url='https://packhacker.com/travel-gear/bagsmart/blast-compression-travel-packing-cubes/'),
'facecam':dict(by='EposVox',title='Facecam MK.2 · control, HDR and focus tests',url='https://www.youtube.com/watch?v=qn5Mmot8OQM',video='qn5Mmot8OQM'),
'yeti':dict(by='The Podcast Host',title='Blue Yeti · technique, value and limitations',url='https://www.thepodcasthost.com/equipment/blue-yeti-podcasting-review/'),
'mv7':dict(by='Podcastage',title='MV7+ · sound tests and comparisons',url='https://www.youtube.com/watch?v=jHd3kQNEWyQ',video='jHd3kQNEWyQ'),
'q2u':dict(by='Podcastage',title='Q2U · USB and XLR tested',url='https://www.youtube.com/watch?v=qjCJbhjFYiA',video='qjCJbhjFYiA'),
'sm7':dict(by='Podcastage',title='Studio microphones · SM7B at 08:13',url='https://www.youtube.com/watch?v=_bg1cy8AUvI&t=493',video='_bg1cy8AUvI'),
'brio':dict(by='Primal Video',title='Brio 4K · hands-on review',url='https://primalvideo.com/guides/logitech-brio-review-best-4k-webcam/'),
'key':dict(by='EposVox',title='Key Light · an original-generation review',url='https://www.youtube.com/watch?v=PHWkRwnbmBI',video='PHWkRwnbmBI'),
'stream':dict(by='EposVox',title='Stream Deck MK.2 · is it worth it?',url='https://streamguides.gg/2021/07/elgato-stream-deck-mk-2-review-is-a-stream-deck-even-worth-it-in-2021/'),
'dji':dict(by='Dunna Did It',title='Pocket 3 · USB webcam walkthrough',url='https://www.youtube.com/watch?v=pjCq94w8UYQ',video='pjCq94w8UYQ')}
def item(t,asin,why,best,pros,cons,setup,source=None,review=None,eco='Universal',complexity='Simple',name=None,box=None):
    if asin:
        row=next(x for x in ledger if x['asin']==asin)
        assert row['decision'] in ['include','owner-exception']
    return dict(t=t,asin=asin,name=name or names.get(asin),why=why,best=best,pros=pros,cons=cons,setup=setup,
                source=spec.get(source,source),review=reviews.get(review),ecosystem=eco,complexity=complexity,
                box=box or 'Check the selected listing and package contents before ordering.',up='',down='',
                exception=bool(asin and next(x for x in ledger if x['asin']==asin)['decision']=='owner-exception'))
def free(t,name,why,setup):
    return item(t,None,why,'Applicants whose current equipment already works',['No purchase','Familiar setup'],['Requires a deliberate rehearsal'],setup,name=name,box='Use what you already own.')
def cat(id,name,intro,items,pick='bc'):
    # Different tiers describe value and complexity, not guaranteed better interview outcomes.
    for j,x in enumerate(items):
        x['up']='More control or convenience; more cost and rehearsal.' if j<len(items)-1 else ''
        x['down']='Simpler equipment is sufficient when the setup test passes.' if j else ''
    return dict(id=id,name=name,intro=intro,items=items,pick=pick)
online=[cat('webcam','Cameras & webcams','Light and eye-level framing come first. Interview platforms may compress video; a 4K sensor does not guarantee a 4K call.',[
item('pe','B085TFF7M1','A familiar 1080p route when your built-in camera is the weak link.','A well-lit desk on a limited budget',['1080p video','Simple USB connection'],['Limited headroom in difficult light'], 'Raise to eye level; test autofocus in the actual interview app.',source='https://support.logi.com/hc/nl/articles/17368441997847-C920-Technical-Specifications',eco='Logitech',name='Logitech C920x HD Pro Webcam',box='Exact C920x variant is linked on Amazon. Manufacturer specifications are for the C920 family; included software and accessories differ by variant.'),
item('bc','B09NBWWP79','A 4K sensor with adjustable field of view, used at a reliable interview resolution.','A permanent desk with straightforward USB setup',['4K30 / 1080p60 capability','65°, 78° or 90° framing'],['4K needs USB 3.0','Platform limits still apply'],'Start at 1080p30. Match the field of view to your room; use a direct port.',source='logi',review='brio',eco='Logitech'),
item('fc','B0CW1S7XP5','Manual Camera Hub control is useful if you already run an Elgato studio. Owner-approved Elgato exception to the rating threshold.','Existing Elgato owners who value repeatable control',['1080p60 capability','Fixed focus and manual image control'],['Fixed-focus working distance','Below the usual rating threshold'],'Check the documented focus range and USB port; save an exposure preset after lighting.',source='facecam',review='facecam',eco='Elgato',complexity='Moderate'),
item('pj','B0BTTV6CT1','A real interchangeable-lens path for applicants who will also teach or create video. Buy the full chain, not only a camera body.','A creator with time to rehearse',['RF-S 18–45mm lens included','Clean HDMI output'],['Capture, mount and sustained power add cost','Focus and heat need a long rehearsal'],'RF-S 18–45mm at the wide end → stable mount → micro-HDMI cable → capture card → direct USB. Use Canon-approved continuous power. Rehearse for the full interview length; keep a webcam backup.',source='canon',review='canon',eco='Canon RF',complexity='Advanced',box='This ASIN is the camera + RF-S 18–45mm lens kit. Capture card, HDMI cable, stable mount and continuous power are separate.')]),
cat('mic','Microphones & audio','Choose USB for the shortest reliable path. XLR buys studio flexibility, and adds an interface, cables and gain decisions.',[
item('pe','B07FKG8PGZ','A dynamic microphone with direct USB and an XLR growth path.','Shared housing with a manageable quiet corner',['USB and XLR','Headphone monitoring'],['Close microphone technique','Desk knocks can travel through a stand'],'Speak across the grille at close range. Use headphones for playback; put soft furnishings in the room.',source='q2u',review='q2u',eco='USB / XLR',box='Recording pack includes a desk tripod, windscreen, USB and XLR cables; confirm the selected pack.'),
item('bc','B00N1YPXW2','A practical choice if you already own one and have a quiet room. More expensive does not mean better noise isolation than a dynamic mic.','Quiet rooms and existing Yeti owners',['USB simplicity','Onboard gain and monitoring'],['Condenser hears room noise','Bulky desktop footprint'],'Select cardioid. Speak into the SIDE, not the top; keep gain low and the mic near you.',source='yeti',review='yeti',eco='Logitech / Blue'),
item('fc','B0CTJ7PVN1','Premium Shure voice audio with a direct USB-C path. An interface is optional for its separate XLR output.','Frequent interviews and later teaching',['USB-C or XLR','Headphone monitoring','Onboard processing in USB mode'],['Stand/arm needed','Extra processing should be rehearsed'],'Use USB-C directly. Set MOTIV processing once, then test in your interview app. Avoid stacking heavy noise processing in both apps.',source='mv7',review='mv7',eco='Shure / USB-XLR',complexity='Moderate',box='MV7+ microphone and USB-C cable. This microphone-only variant needs a stand or arm.'),
item('pj','B0002E4Z8M','A broadcast studio choice when you also record. SM7B is XLR-only; the interface is part of the purchase.','An established studio, not a first microphone',['Flexible studio sound','Dynamic capsule'],['Needs substantial clean preamp gain','Heavy arm and more cables'],'Budget for SM7B + XLR cable + interface with about 60 dB of clean gain for quiet speech + robust arm. Add an inline booster only if the interface cannot deliver enough clean gain. SM7dB has a powered preamp; it still needs an interface and 48V for active gain.',source='sm7',review='sm7',eco='XLR',complexity='Advanced',box='Microphone with yoke/windscreen. Interface, XLR cable, arm and optional booster are separate.')]),
cat('light','Lighting','Make your face easy to see. Window position, glare and backlight matter before brightness specifications.',[
free('pe','Window + soft room light','Use a window in front of you; the first upgrade may be moving the desk.','Test at the actual interview time. Add a curtain if sunlight is harsh.'),
item('bc','B097QZGRCQ','A compact USB light for a small desk without a networked lighting system.','Laptop or small monitor setups',['USB power','Compact placement'],['Less coverage than a large panel'],'Raise above eye level, soften reflections in glasses and match room colour temperature.',source='litra',eco='Logitech'),
item('fc','B07L755X9G','The original 2,800-lumen Elgato panel brings adjustable, repeatable key light.','A permanent Elgato desk',['2900–7000 K adjustment','App / Stream Deck control'],['Requires outlet and Wi-Fi pairing','Clamp clearance required'],'Place off-axis and slightly above eye level. Pair through Control Center before interview day. This listing is the original Key Light; current-generation pages can describe different connectivity.',source='key',review='key',eco='Elgato',complexity='Moderate',box='Key Light, Master Mount L, power supply and cable clips; verify the exact listing.'),
item('pj','B07L755X9G','Two of the same verified Key Light can form a key/fill studio. A second panel is optional, not an interview requirement.','A larger room also used for teaching',['Matched controls','Flexible key/fill balance'],['Two outlets and clamps','Diminishing interview benefit'],'Buy TWO units of this exact model if needed. Run the fill lower than the key and check glare. Do not use maximum brightness by default.',source='key',review='key',eco='Elgato',complexity='Moderate',name='Elgato Key Light · two-light plan')]),
cat('mount','Mounting & capture','Solve the position first. A capture card is only for a camera with a supported clean HDMI output.',[
free('pe','Raise your existing camera','A stable stack or stand puts the lens at eye height.','Check stability and ventilation. Keep the lens just above the screen.'),
free('bc','Reuse the camera’s own mount','A webcam monitor clip or a tripod you own may already solve the problem.','Confirm the manufacturer mount and load rating; route cables without tension.'),
item('fc','B097376LKF','Keeps a microphone within easy speaking distance, below the camera frame.','Permanent desks with a suitable clamp edge',['Low-profile cable routing','Up to 2 kg mic + accessories'],['Needs desk edge clearance','Check monitor and keyboard collisions'],'Measure the desk edge (up to 60 mm for the documented LP). Include mic + shock mount in the total load.',source='arm',eco='Elgato / Universal',complexity='Moderate'),
item('pj','B07K3FN5MR','Turns a compatible HDMI camera into a USB video source. It does not power the camera.','Mirrorless camera owners',['Clean HDMI capture','Works as USB video source'],['Requires supported camera, cable and power','Dedicated USB bandwidth matters'],'Check the exact Cam Link hardware revision and camera compatibility list. Camera → compatible HDMI cable → Cam Link → direct USB 3 port; add continuous camera power separately.',source='camlink',eco='HDMI / Elgato',complexity='Advanced')]),
cat('background','Background & room','Choose an uncluttered, private space. A visible wall, a virtual background or a backdrop can all work after a rehearsal.',[
free('pe','A quiet, uncluttered corner','Make the room support the conversation.','Remove private documents and distractions from the frame.'),
free('bc','Use the soft furnishings you own','Curtains, a rug and nearby soft surfaces may reduce echo.','Record a short clip; compare before and after moving within the room.'),
free('fc','Rehearse the interview platform background','If privacy requires a virtual background, test edges and motion.','Wear the actual outfit and check hands, hair and chair edges.'),
free('pj','A repeatable interview room','A dedicated space reduces day-of variables more than another purchase.','Mark your chair and light positions; arrange access to a quieter backup space.')],pick='pe'),
cat('power','Power & connectivity','A browser online signal is not a bandwidth or call-quality test. Rehearse the actual platform and a backup connection.',[
free('pe','Charger + a tested backup','Use the charger and phone you own.','Plug in; confirm you can open the interview link and contact the coordinator offline.'),
item('bc','B08CK9X9Z8','A straightforward wired path when the router is reachable.','Laptops with a compatible USB-C data port',['Up to 1 Gbps link','No extra wireless network'],['Ethernet cable separate','Does not fix a weak ISP connection'],'Add a tested Ethernet cable to your router. Keep Wi-Fi as fallback. Test the adapter on your OS and exact port.',source='ethernet',eco='USB-C / Ethernet'),
free('fc','Rehearsed hotspot fallback','A tested second network is more useful than an untested battery purchase.','Check your data plan, reception and hotspot compatibility; practice reconnecting in your platform.'),
free('pj','A second ready-to-join device','Continuity depends on the whole route: power, network, login and audio.','Prepare a charged second device with the right app. Follow program instructions for reconnecting.')]),
cat('accessories','Control & accessories','Shortcuts are optional. Keep interview notes concise and avoid a teleprompter that makes your answers sound read.',[
free('pe','Keyboard shortcuts + paper notes','Start with the controls you already know.','Practice mute/unmute in the actual platform; do not map a shortcut that conflicts with another app.'),
item('bc','B0CVY4566H','An eight-key control surface for simple repeatable actions.','An existing Elgato workspace',['Visible labels','Lighting shortcuts'],['Not necessary for an interview','App/plugin compatibility varies'],'Map a light preset and a tested mute shortcut. Do not assume a global mute action works in every platform.',source='https://www.elgato.com/us/en/p/stream-deck-neo',review='neo',eco='Elgato',complexity='Moderate'),
item('fc','B09738CV2G','Fifteen customizable keys for a studio you will use beyond interviews.','Educators who already control lights and software',['More one-touch actions','Elgato integration'],['More preparation than keyboard shortcuts'],'Use a small interview profile with only needed controls. Test every plugin and shortcut before the call.',source='stream',review='stream',eco='Elgato',complexity='Moderate'),
item('pj','B0BJL8SJ59','Dials and touch control are useful for a larger ongoing media workflow.','A studio creator, not a required student upgrade',['Physical dials','Lighting/audio workflow options'],['Adds cost without improving answers','Software and plugin dependency'],'Treat this as a studio investment. Verify your audio setup and plugin route; it is not itself an XLR interface.',source='https://www.elgato.com/us/en/p/stream-deck-plus',review='plus',eco='Elgato',complexity='Advanced')])]
inperson=[cat('padfolio','Portfolio & documents','A clean CV, pen and question list are enough. Follow the program’s instructions about what to bring.',[
free('pe','The folder you already own','Present flat, clean copies without buying a new accessory.','Bring requested documents, a pen and program notes; avoid unnecessary personal records.'),
item('bc','B004HMRQF4','A letter-size padfolio keeps a writing pad and interview papers together.','An applicant who needs a simple document carry',['Organized writing surface','Letter-size format'],['Faux leather, not full-grain leather','Confirm storage capacity'],'Load the night before. Carry only documents the program requests; protect identity papers separately.',source='samsill'),
free('fc','Reuse a durable portfolio + separate ID pouch','Keep travel identity documents apart from interview handouts.','Use a secure pouch you own; keep digital copies privately accessible.'),
free('pj','A tailored document workflow','Spend the effort on program-specific notes and a reliable itinerary.','One folder per program, contacts offline, and a checklist at the hotel.')]),
cat('documents','Travel documents','Separate access essentials from the papers you may hand to a program.',[
free('pe','Offline itinerary','Save the address, arrival instructions and coordinator contact.','Use your device’s private offline storage; avoid publishing travel details.'),
free('bc','ID in a secure pouch','A familiar pouch prevents a last-minute search.','Check your carrier’s current accepted identification requirements.'),
free('fc','Separate program packet','Keep requested copies clean and easy to reach.','Use a folder; do not carry originals unless the program requests them.'),
free('pj','A rehearsed arrival route','Confidence comes from knowing where to go.','Confirm entrance, travel time, accessibility needs and coordinator instructions.')]),
cat('packing','Packing cubes','Organize soft clothing without compressing tailoring. Cubes do not make a suit wrinkle-proof.',[
item('pe','B014VBGUCA','Four mesh-top organizers separate essentials in the luggage you own.','Occasional travel',['Visible contents','Multiple organizer sizes'],['No compression mechanism'],'Use for soft layers and accessories; pack the suit separately. Current listing is Amazon Essentials, previously Amazon Basics.',source='https://www.amazon.com/dp/B014VBGUCA'),
item('bc','B09KN3FMY7','A compression zipper can reduce the volume of suitable soft clothing.','Carry-on packing with limited space',['Compression organization','Separate clothing categories'],['Not for suit jackets','Overfilling strains zippers'],'Compress soft layers only. Do not overfill; compare your chosen set dimensions.',source='cubes',review='cubes'),
free('fc','A garment folder you already own','Preserve the shape of shirts and tailoring separately from cubes.','Follow garment care instructions; unpack and hang on arrival.'),
free('pj','A complete reusable packing plan','Travel smoothly with a checklist, not a larger shopping cart.','Group outfit, care items, documents and charging in separate accessible sections.')]),
cat('garment','Garment care','Follow the fabric care label. Hotel steam and a new steamer are not substitutes for correct pressing.',[
free('pe','Hang on arrival','Give your outfit time to settle before morning.','Use a suitable hanger; avoid wet bathroom exposure for delicate garments.'),
free('bc','Ask about hotel pressing','Confirm a service before relying on it.','Check timing, cost and fabric handling; keep a backup outfit.'),
free('fc','Use a steamer you already tested','Only steam fabrics and trims that permit it.','Follow the manufacturer instructions, protect skin and avoid over-wetting.'),
free('pj','Professional pressing before travel','A fitted and pressed outfit is a better investment than luxury care gadgets.','Use the garment’s care label and pack with a tested garment folder.')]),
cat('powertravel','Portable power','Pack your original charger and actual cables. No unqualified power bank is substituted just to fill a tier.',[
free('pe','Your original phone charger','A familiar charger is enough for a hotel stay.','Charge overnight; keep itinerary accessible offline.'),
free('bc','Your tested laptop charging kit','Check that every cable matches your devices.','Verify the laptop’s power requirement; avoid using an unfamiliar low-output charger.'),
free('fc','The bank you already own','Verify model, recall status and carrier rules before travel.','Confirm usable output and current airline rules; power banks go where your carrier requires.'),
free('pj','Power + contact fallback','Prepare for a dead phone without relying on another purchase.','Printed address, coordinator contact and a charging stop in your itinerary.')]),
cat('grooming','Finishing details','Choose a routine you can repeat comfortably. Presentation preferences are yours; fit and cleanliness matter more than a label.',[
free('pe','A daylight mirror check','Check collar, lint, clean nails and shoes.','Do the last check before leaving the hotel.'),
free('bc','A small care pouch','Bring the familiar items you actually use.','Pack a comb, travel oral care and a lint roller you own.'),
free('fc','A complete outfit rehearsal','Check the look sitting, walking and under camera light.','Avoid trying a new grooming product on interview morning.'),
free('pj','Tailoring + repeatability','Spend on fit where necessary, then simplify the morning.','Confirm comfort through the whole interview day.')]),
cat('emergency','Emergency kit','Small problems need small fixes. Build a familiar pouch rather than an expensive “interview kit.”',[
free('pe','Lint roller + spare pen','Use familiar essentials you already have.','Check the outfit and writing tools before leaving.'),
item('bc','B0C4WC8QJR','A pocket stain pen for many fresh food and drink spills.','Travel days with an outfit at risk',['Portable','Targets fresh food/drink stains'],['Does not fix every stain','Fabric suitability needs checking'],'Follow the care label and product instructions. Test an inconspicuous area; blot residue with a damp cloth.',source='tide'),
free('fc','Sewing kit + safety pins','A lost button should not derail the morning.','Pack a spare button, familiar sewing kit and small pins; check carrier rules for sharp items.'),
free('pj','Backup shirt + care pouch','The most effective full kit includes a spare wearable layer.','Keep a pressed backup shirt separate; include familiar care items and shoes that already fit.')]),
cat('luggage','Luggage & arrival','Use luggage that meets your specific airline and fare limits. Product marketing does not establish airline approval.',[
free('pe','Use your existing bag','Clean and functional beats new and unfamiliar.','Measure including wheels/handles against current airline limits.'),
free('bc','A separate garment plan','A garment folder can fit into luggage you already own.','Keep interview clothes accessible; leave room rather than forcing the zipper.'),
free('fc','Test the full travel load','Walk with the packed bag and check all wheels and zippers.','Adjust the load and plan transfers; carry valuables according to carrier rules.'),
free('pj','Arrival margin + backup outfit','Reliability comes from time and contingency, not luxury branding.','Plan an arrival buffer where possible; prepare for delayed baggage.')])]
extra=[item('fc','B0CG19QXWD','An existing Pocket 3 can double as a USB webcam; do not buy it solely for an interview.','A travelling creator who already owns DJI gear',['USB webcam mode','Compact camera'],['Gimbal can move the framing','Mount, power and mode need rehearsal'],'Use a stable mount, USB webcam mode and steady framing. Test tracking settings; keep automatic movement from distracting the interviewer.',source='dji',review='dji',eco='DJI',complexity='Moderate')]
public=dict(researchedOn='2026-10-03',online=online,inperson=inperson,alternatives=extra,reviews=reviews,
            held=[dict(name=r['model'],asin=r['asin'],reason='Did not meet the default Amazon rating threshold at this check.') for r in ledger if r['decision']=='hold'])
# Product media is separately sourced and tied to the exact model/ASIN.
media_file=ROOT/'evidence/product-media.json'
media=json.loads(media_file.read_text()) if media_file.exists() else []
for c in online+inperson:
    for x in c['items']:
        match=next((m for m in media if m.get('asin')==x.get('asin') and m.get('derivative')),None)
        if match:x['image']=match['derivative']
(ROOT/'catalog.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n')
print(f'{len(ledger)} exact listing observations; {sum(len(c["items"]) for c in online+inperson)} paths; {len(set(x["asin"] for c in online+inperson for x in c["items"] if x["asin"]))+1} unique purchase candidates')
