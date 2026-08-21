export const PINNED_ROTATION_SPECIALTIES=Object.freeze([
  "Internal Medicine",
  "Family Medicine",
  "Pediatrics",
  "Psychiatry",
  "General Surgery",
  "Obstetrics and Gynecology",
  "Emergency Medicine",
  "Neurology",
  "Anesthesiology",
  "Radiology",
  "Pathology"
]);

// Accepted local vocabulary derived from the ACGME May 2026 specialty and
// subspecialty table. It is kept local so the Builder never depends on a
// third-party service for a clinically governed choice.
export const ALL_ROTATION_SPECIALTIES=Object.freeze([...new Set([
  "Abdominal Radiology","Addiction Medicine","Addiction Psychiatry","Adolescent Medicine",
  "Adult Cardiothoracic Anesthesiology","Adult Congenital Heart Disease",
  "Adult Reconstructive Orthopaedic Surgery","Advanced Heart Failure and Transplant Cardiology",
  "Aerospace Medicine","Allergy and Immunology","Anesthesiology",
  "Anesthesiology Critical Care Medicine","Blood Banking/Transfusion Medicine",
  "Brain Injury Medicine","Cardiovascular Disease","Chemical Pathology","Child Abuse Pediatrics",
  "Child and Adolescent Psychiatry","Child Neurology","Clinical Biochemical Genetics",
  "Clinical Cardiac Electrophysiology","Clinical Informatics","Clinical Neurophysiology",
  "Colon and Rectal Surgery","Complex Family Planning","Complex General Surgical Oncology",
  "Congenital Cardiac Surgery","Consultation-Liaison Psychiatry",
  "Correctional (Carceral) Medicine","Craniofacial Plastic Surgery","Critical Care Medicine",
  "Cytopathology","Dermatology","Dermatopathology","Developmental-Behavioral Pediatrics",
  "Diagnostic Radiology","Emergency Medical Services","Emergency Medicine",
  "Endocrinology, Diabetes, and Metabolism","Epilepsy","Family Medicine",
  "Foot and Ankle Orthopaedic Surgery","Forensic Pathology","Forensic Psychiatry",
  "Gastroenterology","General Surgery","Geriatric Medicine","Geriatric Psychiatry",
  "Gynecologic Oncology","Hand Surgery","Health Care Administration, Leadership, and Management",
  "Hematology","Hematology and Medical Oncology","Hematopathology",
  "Hospice and Palliative Medicine","Infectious Disease","Internal Medicine",
  "Internal Medicine-Pediatrics","Interventional Cardiology","Interventional Pulmonology",
  "Interventional Radiology","Interventional Radiology - Independent",
  "Interventional Radiology - Integrated","Laboratory Genetics and Genomics",
  "Maternal-Fetal Medicine","Medical Biochemical Genetics","Medical Genetics and Genomics",
  "Medical Microbiology","Medical Oncology","Medical Toxicology",
  "Micrographic Surgery and Dermatologic Oncology","Molecular Genetic Pathology",
  "Musculoskeletal Oncology","Musculoskeletal Radiology","Neonatal-Perinatal Medicine",
  "Nephrology","Neurocritical Care","Neurodevelopmental Disabilities",
  "Neuroendovascular Intervention","Neurological Surgery","Neurology","Neuromuscular Medicine",
  "Neuropathology","Neuroradiology","Neurotology","Nuclear Medicine","Nuclear Radiology",
  "Obstetric Anesthesiology","Obstetrics and Gynecology","Occupational and Environmental Medicine",
  "Ophthalmic Plastic and Reconstructive Surgery","Ophthalmology","Orthopaedic Sports Medicine",
  "Orthopaedic Surgery","Orthopaedic Surgery of the Spine","Orthopaedic Trauma",
  "Osteopathic Neuromusculoskeletal Medicine","Otolaryngology – Head and Neck Surgery",
  "Pain Medicine","Pathology","Pediatric Anesthesiology","Pediatric Cardiac Anesthesiology",
  "Pediatric Cardiology","Pediatric Critical Care Medicine","Pediatric Dermatology",
  "Pediatric Emergency Medicine","Pediatric Endocrinology","Pediatric Gastroenterology",
  "Pediatric Hematology-Oncology","Pediatric Hospital Medicine","Pediatric Infectious Diseases",
  "Pediatric Nephrology","Pediatric Orthopaedic Surgery","Pediatric Otolaryngology",
  "Pediatric Pathology","Pediatric Pulmonology","Pediatric Radiology",
  "Pediatric Rehabilitation Medicine","Pediatric Rheumatology","Pediatric Surgery",
  "Pediatric Transplant Hepatology","Pediatric Urology","Pediatrics",
  "Physical Medicine and Rehabilitation","Plastic Surgery","Preventive Medicine","Psychiatry",
  "Public Health and General Preventive Medicine","Pulmonary Critical Care","Pulmonary Disease",
  "Pulmonary Disease and Critical Care Medicine","Radiation Oncology","Radiology",
  "Regional Anesthesiology and Acute Pain Medicine","Reproductive Endocrinology and Infertility",
  "Rheumatology","Selective Pathology","Sleep Medicine","Spinal Cord Injury Medicine",
  "Sports Medicine","Surgery","Surgical Critical Care","Thoracic Surgery","Transitional Year",
  "Transplant Hepatology","Transplant Nephrology","Undersea and Hyperbaric Medicine",
  "Urogynecology and Reconstructive Pelvic Surgery","Urology","Vascular Neurology",
  "Vascular Surgery"
])]);

const PINNED_INDEX=new Map(
  PINNED_ROTATION_SPECIALTIES.map((label,index)=>[label,index])
);

export function normalizeSpecialtyId(value){
  const label=String(value||"").trim();
  if(!label)return"";
  return`acgme:${label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase()
    .replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")}`;
}

export function specialtyOption(label){
  const value=String(label||"").trim();
  return Object.freeze({
    id:normalizeSpecialtyId(value),
    specialtyId:normalizeSpecialtyId(value),
    value,
    label:value,
    pinned:PINNED_INDEX.has(value)
  });
}

export function rankSpecialtyMatches(matches,{query=""}={}){
  const needle=String(query||"").trim().toLocaleLowerCase();
  return[...(matches||[])]
    .map((item,index)=>({
      item,
      index,
      label:String(item?.value||item?.label||item||"")
    }))
    .filter(({label})=>
      !needle||label.toLocaleLowerCase().includes(needle)
    )
    .sort((left,right)=>{
      const leftPinned=PINNED_INDEX.get(left.label);
      const rightPinned=PINNED_INDEX.get(right.label);
      const leftRank=leftPinned==null?1:0;
      const rightRank=rightPinned==null?1:0;
      return leftRank-rightRank||
        (leftRank===0?leftPinned-rightPinned:0)||
        left.label.localeCompare(right.label)||
        left.index-right.index;
    })
    .map(({item})=>item);
}
