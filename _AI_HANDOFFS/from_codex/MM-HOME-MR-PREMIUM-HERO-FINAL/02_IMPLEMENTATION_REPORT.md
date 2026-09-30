# Implementation report

## Homepage

The homepage now uses one premium, full-bleed, eight-frame hero in this exact order:

1. Mission Residency — application
2. ExamPrep — live teaching
3. Mission Residency — communication
4. USCE — clinical fit
5. Mission Residency — ranking evidence
6. ExamPrep — clinical reasoning
7. Mission Residency — story/community
8. USCE — pathway

Frame 01 uses the Founder-approved message exactly:

> YOU BUILT THE APPLICATION  
> that earned the interview.  
> NOW LET'S TURN THE INTERVIEW  
> INTO A MATCH.

Support: `Build the communication, story and connection skills that matter when programs meet you.`

CTA: `Explore Interview Bootcamp Week`.

The prior homepage hero is removed at the final output boundary, independent of HTML attribute order. Stale strings are absent from the current presentation source and the rendered anonymous DOM.

Rotation is one bounded 12-second timer, pauses on manual interaction, hover, focus, page invisibility, off-screen intersection, reduced motion, and mobile. Controls include division select, previous, next, play/pause, and eight slide selectors. Only the initial and next image are prepared eagerly.

## Dedicated Mission Residency page

The page uses a single static presentation hero with the same approved message and support, explicit Bootcamp Week and IV Prep Complete paths, bounded NRMP evidence, authentic Marian proof, and a compact mobile disclosure navigation. There is no hero carousel on this route.

Campaign attribution now preserves all five supported UTM fields while retaining `/mission-residency/` for same-page hash navigation.

