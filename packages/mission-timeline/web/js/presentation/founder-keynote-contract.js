/*
 * D1-TIMELINE-FOUNDER-REANCHOR-015 presentation custody contract.
 *
 * The Founder source and its rendered evidence are intentionally represented
 * by checksums only. Founder imagery is never copied into the repository or
 * into automated fixtures. Tests use synthetic content on the same 1920x1080
 * presentation geometry and bind every result back to these immutable hashes.
 */

export const FOUNDER_KEYNOTE_GOLDEN_NAMESPACE=
  "d1-timeline-founder-reanchor-021/synthetic-golden-master/keynote-2025-v1";

export const FOUNDER_KEYNOTE_CONTRACT=Object.freeze({
  schemaVersion:"d1-timeline-founder-keynote-contract/1",
  authority:"FOUNDER_SELECTED_2025_KEYNOTE",
  namespace:FOUNDER_KEYNOTE_GOLDEN_NAMESPACE,
  canvas:Object.freeze({width:1920,height:1080,orientation:"landscape"}),
  source:Object.freeze({
    kind:"application/x-iwork-keynote-sffkey",
    sha256:"113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706"
  }),
  verifiedEvidence:Object.freeze({
    pngSha256:"bf48d25b2d46a75c868f98692d480147f8c7d8f234955608a27ca50b3b808836",
    pdfSha256:null
  }),
  lineage:Object.freeze({
    supersededAuthority:"FOUNDER_SUPPLIED_2024_KEYNOTE",
    sourceSha256:"da6a7fa74a2f5d42f53399a9fc00bfe7283e7e4b79f349fca062da0be106cc19",
    pngSha256:"494694390329b0c050d7b4ca55c32b06e78eadc6375014b8a6b32c17ef36447a",
    pdfSha256:"7d13f2746ff72e678a3a0b9c6a81dc42aedb467bc5266896ed9f253a4cc7e9e1",
    selectionEvidence:"Founder designation recorded in 016 audit 04; 2025 source and Mac golden reverified during D1-021",
    assetPolicy:"Existing approved nonpersonal furniture retained; 2025 Data/image1-8.jpeg is byte-identical to the pinned board. No personal Founder imagery published."
  }),
  assets:Object.freeze({
    board:Object.freeze({
      sourcePath:"Data/image1-8.jpeg",
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
// sRGB projection of flat legend swatches in the hash-pinned Display P3 golden.
// Values are color-managed raster evidence, not an invented palette or native-fill claim.
export const FOUNDER_COLOR_KEY_ROWS=Object.freeze([
  Object.freeze({id:"work",label:"Work Experience",color:"#00882B"}),
  Object.freeze({id:"personal",label:"Personal (Not on CV)",color:"#763F9B"}),
  Object.freeze({id:"exams",label:"USMLE Studies",color:"#0565C0"}),
  Object.freeze({id:"clinical-hospital",label:"USCE: Teaching Hosp",color:"#DF6A0F"}),
  Object.freeze({id:"clinical-clinic",label:"USCE: Clinics",color:"#F49018"}),
  Object.freeze({id:"research",label:"Research Experience",color:"#DCBE23"})
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
    ...(FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pdfSha256?{"data-founder-golden-pdf-sha256":FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pdfSha256}:{}),
    "data-founder-board-asset-sha256":FOUNDER_KEYNOTE_CONTRACT.assets.board.sha256,
    "data-founder-usa-flag-asset-sha256":FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.sha256
  });
}

// The reference defines identity; unsupported density policy is never inferred.
export const FOUNDER_TEMPLATE_GRAMMAR=Object.freeze({
  schemaVersion:"missionmed-founder-2025-grammar/1",
  sourceSha256:FOUNDER_KEYNOTE_CONTRACT.source.sha256,
  goldenSha256:FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pngSha256,
  locked:Object.freeze({canvas:FOUNDER_KEYNOTE_CONTRACT.canvas,slideCount:1,
    background:"textured-blue-board",title:"centered-framed-plaque",axis:"navy-chevron-year-ribbon",
    duration:"category-arrow-with-direct-label-and-date",milestone:"pole-and-date-pennant",examResultMarker:"explicit-result-flag-attached-to-study-arrow-below-ribbon",
    profile:"mounted-white-paper-with-portrait",photos:"white-snapshot-frames",
    interview:"program-logo-purple-ribbon-date",annotations:"authored-sticky-notes-and-pointers",
    colorKeyIds:Object.freeze(FOUNDER_COLOR_KEY_ROWS.map(row=>row.id)),
    colors:Object.freeze({profile:"Display P3 golden converted to sRGB",rows:FOUNDER_COLOR_KEY_ROWS,insideArrowText:"#FFFFFF"}),
    typography:Object.freeze({
      title:Object.freeze({family:"American Typewriter",size:36,weight:400}),
      arrowLabel:Object.freeze({family:"American Typewriter",size:18,weight:400}),
      date:Object.freeze({family:"Baskerville",size:18,weight:400}),
      institution:Object.freeze({family:"Baskerville",size:19,weight:400}),
      year:Object.freeze({family:"Futura",size:23,weight:700}),
      colorKey:Object.freeze({family:"Futura",size:18,weight:500}),
      profile:Object.freeze({family:"American Typewriter",size:19,labelsWeight:700,valuesWeight:400})
    }),
    nativeFontNames:Object.freeze(["AmericanTypewriter","AmericanTypewriter-Bold","Baskerville","Futura-Bold","Futura-Medium"])}),
  parametric:Object.freeze(["confirmed-facts","source-date-precision","placement","spacing","nonuniform-year-widths","wrapping","authored-geometry","authored-media-crops","audience-projection"]),
  prohibited:Object.freeze(["numbered-experience-directory","gantt-replacement","automatic-continuation","automatic-fact-abbreviation","silent-material-omission"]),
  undefined:Object.freeze(["extreme-density-consolidation","education-seventh-key-row","automatic-year-compression","absent-furniture-policy","minimum-print-font-size"])
});
