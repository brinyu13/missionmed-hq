# Responsive production QA

The anonymous public homepage passed all eight frames at viewport widths 1440, 1024 and 390. The premium full-bleed opening maintained the authentic MATCHED / ACCOMPLISHED patch, readable four-line payoff, accessible CTA, controls, and no horizontal overflow or clipped headline. The desktop and 390px contact sheets and Frame-01 screenshots in `live-qa/` were visually inspected; `live-qa.json` supplies geometry and image-load assertions for every frame.

The public Mission Residency page passed the same widths after the `5f59a91` closing-section change: exact final headline, both program paths and anchors visible, zero overflow or JavaScript errors. Dedicated 1440/1024/390 captures and corrected closing-section captures are in `live-qa/`; structured results are in `mr-final-qa.json`.
