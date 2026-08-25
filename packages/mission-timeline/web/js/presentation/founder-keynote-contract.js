/*
 * D1-TIMELINE-FOUNDER-REANCHOR-015 presentation custody contract.
 *
 * The Founder source and its rendered evidence are intentionally represented
 * by checksums only. Founder imagery is never copied into the repository or
 * into automated fixtures. Tests use synthetic content on the same 1920x1080
 * presentation geometry and bind every result back to these immutable hashes.
 */

export const FOUNDER_KEYNOTE_GOLDEN_NAMESPACE=
  "d1-timeline-founder-reanchor-015/synthetic-golden-master/keynote-2024-v1";

export const FOUNDER_KEYNOTE_CONTRACT=Object.freeze({
  schemaVersion:"d1-timeline-founder-keynote-contract/1",
  authority:"FOUNDER_SUPPLIED_2024_KEYNOTE",
  namespace:FOUNDER_KEYNOTE_GOLDEN_NAMESPACE,
  canvas:Object.freeze({width:1920,height:1080,orientation:"landscape"}),
  source:Object.freeze({
    kind:"application/x-iwork-keynote-sffkey",
    sha256:"da6a7fa74a2f5d42f53399a9fc00bfe7283e7e4b79f349fca062da0be106cc19"
  }),
  verifiedEvidence:Object.freeze({
    pngSha256:"494694390329b0c050d7b4ca55c32b06e78eadc6375014b8a6b32c17ef36447a",
    pdfSha256:"7d13f2746ff72e678a3a0b9c6a81dc42aedb467bc5266896ed9f253a4cc7e9e1"
  }),
  assets:Object.freeze({
    board:Object.freeze({
      sourcePath:"Data/Magnetboard-1920-107.jpg",
      publicPath:"assets/founder_keynote_2024/background/Magnetboard-1920-107.jpg",
      sha256:"f5d28c36504ea8fa0b54a55975b493bd9a0c1d6948ca447eb88a9198b8777cc1",
      width:1920,
      height:1080,
      classification:"TEMPLATE_FURNITURE_NON_PERSONAL"
    }),
    usaFlag:Object.freeze({
      sourcePath:"Data/USA%20Flag.H03-10831.png",
      publicPath:"assets/founder_keynote_2024/flags/USA-Flag.H03-10831.png",
      sha256:"d2473ecf794b5e8eb69f8eefb107b04101fdef0da1d2e6830d35ab6815bf2a5d",
      width:256,
      height:210,
      classification:"TEMPLATE_FURNITURE_NON_PERSONAL"
    })
  }),
  fixturePolicy:Object.freeze({
    content:"SYNTHETIC_ONLY",
    founderImageryPublished:false,
    purpose:"geometry-and-serializer-regression"
  })
});

/*
 * The original MissionMed composition has six visible key rows. These are
 * presentation defaults, not a replacement for the semantic category model.
 * The IDs remain stable so future user-managed labels can be versioned without
 * weakening existing timelines.
 */
export const FOUNDER_COLOR_KEY_ROWS=Object.freeze([
  Object.freeze({id:"work",label:"Work Experience",color:"#3F9B52"}),
  Object.freeze({id:"personal",label:"Personal (Not on CV)",color:"#8A5BBF"}),
  Object.freeze({id:"exams",label:"USMLE Studies",color:"#3A78C9"}),
  Object.freeze({id:"clinical-hospital",label:"USCE: Teaching Hosp",color:"#C8641C"}),
  Object.freeze({id:"clinical-clinic",label:"USCE: Clinics",color:"#E89B3C"}),
  Object.freeze({id:"research",label:"Research Experience",color:"#D4B636"})
]);

export const FOUNDER_PRESENTATION_DEFAULTS=Object.freeze({
  theme:"keynote-classic",
  background:"canonical-keynote-board",
  axis:"year-ribbon",
  colorKeyRows:FOUNDER_COLOR_KEY_ROWS.length,
  profileCard:true,
  photoFrames:3
});

export function founderContractAttributes(){
  return Object.freeze({
    "data-founder-keynote-contract":FOUNDER_KEYNOTE_CONTRACT.schemaVersion,
    "data-founder-keynote-namespace":FOUNDER_KEYNOTE_CONTRACT.namespace,
    "data-founder-keynote-source-sha256":FOUNDER_KEYNOTE_CONTRACT.source.sha256,
    "data-founder-golden-png-sha256":FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pngSha256,
    "data-founder-golden-pdf-sha256":FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pdfSha256,
    "data-founder-board-asset-sha256":FOUNDER_KEYNOTE_CONTRACT.assets.board.sha256,
    "data-founder-usa-flag-asset-sha256":FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.sha256
  });
}
