#!/usr/bin/env node
/*
 * AAA-019 — curated IMG school supplement.
 *
 * The Wikidata snapshot (global-wikidata-2026-08-24) selects entities that are an
 * instance/subclass of "medical school". Most of the schools MissionMed's students actually
 * come from are modelled on Wikidata as *universities* whose medicine faculty has no item of
 * its own — Semmelweis, Debrecen, Carol Davila, Karolinska, Sapienza, UBA, the Caribbean
 * schools — so a student typing them got "no results" and was pushed to "School not listed".
 *
 * This script emits a small identity-only supplement in the same record schema. It asserts
 * nothing beyond identity (name, country, city, well-known aliases): no accreditation, no
 * active status, not analytics-eligible — the same verification law as the Wikidata set.
 * It also carries alias / city overrides for Wikidata records whose labels or cities are
 * unhelpful or wrong (e.g. "SGU" for St. George's Grenada, Trinity's city "Georgia").
 *
 * Run: node scripts/build-img-supplement-data.mjs
 */
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const DATASET_VERSION="global-img-supplement-2026-09-05";
const out=join(here,"..","web","data","medical-schools",`${DATASET_VERSION}.json`);

const S=(name,country,code,city,aliases=[],extra={})=>({name,country,code,city,aliases,...extra});

/* Identity-only. Names are the institution's usual English name; aliases carry the local
   name and the abbreviations students type. Cities are the main medical campus. */
const SCHOOLS=[
  // Hungary
  S("Semmelweis University Faculty of Medicine","Hungary","HU","Budapest",["Semmelweis University","Semmelweis Egyetem","SOTE","Semmelweis"]),
  S("University of Debrecen Faculty of Medicine","Hungary","HU","Debrecen",["Debreceni Egyetem Általános Orvostudományi Kar","DE ÁOK","University of Debrecen Medical School","Debrecen"]),
  // Romania
  S("Carol Davila University of Medicine and Pharmacy","Romania","RO","Bucharest",["UMF Carol Davila","Universitatea de Medicină și Farmacie Carol Davila","Carol Davila"]),
  S("Iuliu Hațieganu University of Medicine and Pharmacy","Romania","RO","Cluj-Napoca",["UMF Cluj","UMF Iuliu Hațieganu","Cluj Medical School","Universitatea de Medicină și Farmacie Iuliu Hațieganu"]),
  S("Victor Babeș University of Medicine and Pharmacy","Romania","RO","Timișoara",["UMF Timișoara","UMF Victor Babeș","Universitatea de Medicină și Farmacie Victor Babeș"]),
  S("Grigore T. Popa University of Medicine and Pharmacy Faculty of Medicine","Romania","RO","Iași",["UMF Iași","UMF Grigore T. Popa","Universitatea de Medicină și Farmacie Grigore T. Popa"]),
  S("University of Oradea Faculty of Medicine and Pharmacy","Romania","RO","Oradea",["Universitatea din Oradea Facultatea de Medicină și Farmacie","Oradea Medical School"]),
  S("Lucian Blaga University of Sibiu Faculty of Medicine","Romania","RO","Sibiu",["ULBS Faculty of Medicine","Universitatea Lucian Blaga din Sibiu Facultatea de Medicină"]),
  // Poland
  S("Medical University of Warsaw","Poland","PL","Warsaw",["Warszawski Uniwersytet Medyczny","WUM","MUW"]),
  S("Medical University of Lublin","Poland","PL","Lublin",["Uniwersytet Medyczny w Lublinie","MUL"]),
  S("Nicolaus Copernicus University Collegium Medicum","Poland","PL","Bydgoszcz",["Collegium Medicum in Bydgoszcz","Ludwik Rydygier Collegium Medicum","CM UMK"]),
  S("Medical University of Łódź","Poland","PL","Łódź",["Uniwersytet Medyczny w Łodzi","Lodz Medical University"]),
  // Czech Republic / Slovakia
  S("Palacký University Olomouc Faculty of Medicine and Dentistry","Czech Republic","CZ","Olomouc",["Univerzita Palackého v Olomouci Lékařská fakulta","UPOL Medicine"]),
  // Italy
  S("Sapienza University of Rome Faculty of Medicine and Dentistry","Italy","IT","Rome",["Sapienza Università di Roma","Sapienza","La Sapienza","University of Rome La Sapienza"]),
  S("University of Rome Tor Vergata Faculty of Medicine and Surgery","Italy","IT","Rome",["Università degli Studi di Roma Tor Vergata","Tor Vergata"]),
  S("Catholic University of the Sacred Heart Faculty of Medicine and Surgery","Italy","IT","Rome",["Università Cattolica del Sacro Cuore","UCSC Rome","Gemelli"]),
  S("University of Bologna School of Medicine and Surgery","Italy","IT","Bologna",["Università di Bologna","Alma Mater Studiorum Bologna","Bologna"]),
  S("University of Pavia Faculty of Medicine and Surgery","Italy","IT","Pavia",["Università degli Studi di Pavia","Harvey Medical Course Pavia","Pavia"]),
  S("University of Milan Faculty of Medicine and Surgery","Italy","IT","Milan",["Università degli Studi di Milano","La Statale","UniMi","Milan"]),
  S("Humanitas University","Italy","IT","Pieve Emanuele",["Humanitas University Medicine","Hunimed"],{alternate_cities:["Milan"]}),
  S("Vita-Salute San Raffaele University Faculty of Medicine and Surgery","Italy","IT","Milan",["UniSR","San Raffaele University","Vita-Salute"]),
  S("University of Turin School of Medicine","Italy","IT","Turin",["Università degli Studi di Torino","UniTo Medicine","Torino"]),
  S("University of Naples Federico II School of Medicine and Surgery","Italy","IT","Naples",["Università degli Studi di Napoli Federico II","Federico II","Napoli"]),
  S("University of Bari Aldo Moro School of Medicine","Italy","IT","Bari",["Università degli Studi di Bari Aldo Moro","Bari"]),
  S("University of Messina Faculty of Medicine and Surgery","Italy","IT","Messina",["Università degli Studi di Messina","Messina"]),
  S("University of Siena Faculty of Medicine and Surgery","Italy","IT","Siena",["Università degli Studi di Siena","Siena"]),
  S("University of Parma Faculty of Medicine and Surgery","Italy","IT","Parma",["Università degli Studi di Parma","Parma"]),
  S("University of Florence School of Human Health Sciences","Italy","IT","Florence",["Università degli Studi di Firenze","Firenze","Florence Medicine"]),
  S("University of Pisa Faculty of Medicine and Surgery","Italy","IT","Pisa",["Università di Pisa","Pisa"]),
  S("University of Genoa School of Medical and Pharmaceutical Sciences","Italy","IT","Genoa",["Università degli Studi di Genova","Genova"]),
  // Sweden and the Nordics
  S("Karolinska Institutet","Sweden","SE","Stockholm",["Karolinska Institute","KI","Karolinska"],{alternate_cities:["Solna"]}),
  S("Uppsala University Faculty of Medicine","Sweden","SE","Uppsala",["Uppsala universitet Medicinska fakulteten"]),
  S("University of Gothenburg Sahlgrenska Academy","Sweden","SE","Gothenburg",["Sahlgrenska Academy","Göteborgs universitet Sahlgrenska akademin"]),
  S("Linköping University Faculty of Medicine and Health Sciences","Sweden","SE","Linköping",["Linköpings universitet"]),
  S("Örebro University School of Medical Sciences","Sweden","SE","Örebro",["Örebro universitet"]),
  // Caribbean
  S("American University of the Caribbean School of Medicine","Sint Maarten","SX","Cupecoy",["AUC","AUC School of Medicine"],{alternate_cities:["Philipsburg"]}),
  S("Saba University School of Medicine","Caribbean Netherlands","BQ","The Bottom",["Saba University","Saba"],{alternate_cities:["Saba"]}),
  S("Medical University of the Americas","Saint Kitts and Nevis","KN","Charlestown",["MUA","MUA Nevis"],{alternate_cities:["Nevis"]}),
  S("University of Medicine and Health Sciences","Saint Kitts and Nevis","KN","Basseterre",["UMHS","UMHS St. Kitts"]),
  S("Xavier University School of Medicine","Aruba","AW","Oranjestad",["XUSOM","Xavier Aruba"]),
  // Latin America
  S("Universidad de Buenos Aires Facultad de Medicina","Argentina","AR","Buenos Aires",["University of Buenos Aires Faculty of Medicine","UBA","UBA Medicina"]),
  S("Universidad Nacional de Córdoba Facultad de Ciencias Médicas","Argentina","AR","Córdoba",["National University of Córdoba","UNC Córdoba"]),
  S("Universidad Nacional de La Plata Facultad de Ciencias Médicas","Argentina","AR","La Plata",["National University of La Plata","UNLP"]),
  S("Universidad Nacional de Rosario Facultad de Ciencias Médicas","Argentina","AR","Rosario",["National University of Rosario","UNR"]),
  S("Universidad Autónoma de Guadalajara Facultad de Medicina","Mexico","MX","Guadalajara",["UAG","UAG School of Medicine","Autonomous University of Guadalajara"]),
  S("Universidad de Guadalajara Centro Universitario de Ciencias de la Salud","Mexico","MX","Guadalajara",["CUCS","University of Guadalajara","UdeG Medicina"]),
  S("Universidad Autónoma de Nuevo León Facultad de Medicina","Mexico","MX","Monterrey",["UANL","UANL Medicina"]),
  S("Universidad Anáhuac Facultad de Ciencias de la Salud","Mexico","MX","Huixquilucan",["Anáhuac","Universidad Anahuac Medicina"],{alternate_cities:["Mexico City"]}),
  S("Universidad La Salle Facultad Mexicana de Medicina","Mexico","MX","Mexico City",["La Salle Medicina","ULSA"]),
  S("Universidad Panamericana Escuela de Medicina","Mexico","MX","Mexico City",["UP Medicina","Panamericana"]),
  S("Universidad de Antioquia Facultad de Medicina","Colombia","CO","Medellín",["UdeA","University of Antioquia"]),
  S("Universidad Nacional de Colombia Facultad de Medicina","Colombia","CO","Bogotá",["UNAL","National University of Colombia"]),
  S("Universidad del Rosario Escuela de Medicina y Ciencias de la Salud","Colombia","CO","Bogotá",["Universidad del Rosario"]),
  S("Universidad de los Andes Facultad de Medicina","Colombia","CO","Bogotá",["Uniandes Medicina"]),
  S("Universidad Peruana Cayetano Heredia Facultad de Medicina","Peru","PE","Lima",["UPCH","Cayetano Heredia"]),
  S("Universidad Nacional Mayor de San Marcos Facultad de Medicina","Peru","PE","Lima",["UNMSM","San Marcos Medicina","San Fernando"]),
  S("Universidad de Chile Facultad de Medicina","Chile","CL","Santiago",["University of Chile"]),
  S("Pontificia Universidad Católica de Chile Escuela de Medicina","Chile","CL","Santiago",["PUC Chile","UC Chile Medicina"]),
  S("Universidade de São Paulo Faculdade de Medicina","Brazil","BR","São Paulo",["USP","FMUSP","University of São Paulo Medical School"]),
  S("Universidade Federal do Rio de Janeiro Faculdade de Medicina","Brazil","BR","Rio de Janeiro",["UFRJ"]),
  S("Universidad Central de Venezuela Facultad de Medicina","Venezuela","VE","Caracas",["UCV","Central University of Venezuela"]),
  S("Universidad Autónoma de Santo Domingo Facultad de Ciencias de la Salud","Dominican Republic","DO","Santo Domingo",["UASD"]),
  S("Pontificia Universidad Católica Madre y Maestra Facultad de Ciencias de la Salud","Dominican Republic","DO","Santiago de los Caballeros",["PUCMM"]),
  S("Universidad Iberoamericana Escuela de Medicina","Dominican Republic","DO","Santo Domingo",["UNIBE"]),
  // Philippines
  S("University of the Philippines College of Medicine","Philippines","PH","Manila",["UP Manila","UPCM","UP College of Medicine"]),
  S("University of Santo Tomas Faculty of Medicine and Surgery","Philippines","PH","Manila",["UST Medicine","UST FMS"]),
  S("Far Eastern University – Nicanor Reyes Medical Foundation","Philippines","PH","Quezon City",["FEU-NRMF","FEU NRMF"]),
  S("De La Salle Medical and Health Sciences Institute","Philippines","PH","Dasmariñas",["DLSMHSI","De La Salle Medicine"]),
  S("St. Luke's Medical Center College of Medicine","Philippines","PH","Quezon City",["SLMCCM","St. Luke's College of Medicine William H. Quasha Memorial"]),
  S("Cebu Institute of Medicine","Philippines","PH","Cebu City",["CIM"]),
  S("Davao Medical School Foundation","Philippines","PH","Davao City",["DMSF"]),
  S("Our Lady of Fatima University College of Medicine","Philippines","PH","Valenzuela",["OLFU","Fatima Medicine"]),
  // Bulgaria, Baltics
  S("Medical University of Sofia","Bulgaria","BG","Sofia",["Медицински университет София","MU Sofia"]),
  S("Medical University of Plovdiv","Bulgaria","BG","Plovdiv",["MU Plovdiv"]),
  S("Medical University of Varna","Bulgaria","BG","Varna",["MU Varna","Prof. Dr. Paraskev Stoyanov Medical University"]),
  S("Medical University of Pleven","Bulgaria","BG","Pleven",["MU Pleven"]),
  S("Trakia University Faculty of Medicine","Bulgaria","BG","Stara Zagora",["Trakia University Medicine"]),
  S("Rīga Stradiņš University","Latvia","LV","Riga",["Riga Stradins University","RSU"]),
  S("University of Latvia Faculty of Medicine","Latvia","LV","Riga",["Latvijas Universitāte Medicīnas fakultāte"]),
  S("Lithuanian University of Health Sciences","Lithuania","LT","Kaunas",["LSMU","Kaunas University of Medicine"]),
  // Israel
  S("Technion Ruth and Bruce Rappaport Faculty of Medicine","Israel","IL","Haifa",["Technion Faculty of Medicine","Technion Medicine","Rappaport"]),
  S("Tel Aviv University Faculty of Medical and Health Sciences","Israel","IL","Tel Aviv",["Sackler Faculty of Medicine","Sackler School of Medicine","Tel Aviv University Medicine"]),
  // Ukraine
  S("Bogomolets National Medical University","Ukraine","UA","Kyiv",["NMU Bogomolets","Bohomolets National Medical University","Kyiv National Medical University"]),
  S("Kharkiv National Medical University","Ukraine","UA","Kharkiv",["KhNMU","Kharkov National Medical University"]),
  S("National Pirogov Memorial Medical University Vinnytsia","Ukraine","UA","Vinnytsia",["Vinnytsia National Medical University","Pirogov Vinnytsia"]),
  S("Bukovinian State Medical University","Ukraine","UA","Chernivtsi",["BSMU Chernivtsi"]),
  S("Ivano-Frankivsk National Medical University","Ukraine","UA","Ivano-Frankivsk",["IFNMU"]),
  S("Uzhhorod National University Faculty of Medicine","Ukraine","UA","Uzhhorod",["UzhNU Medicine"]),
  S("Sumy State University Academic and Research Medical Institute","Ukraine","UA","Sumy",["SumDU Medical Institute"]),
  S("Poltava State Medical University","Ukraine","UA","Poltava",["Ukrainian Medical Stomatological Academy","UMSA"]),
  S("Dnipro State Medical University","Ukraine","UA","Dnipro",["Dnipropetrovsk Medical Academy","DSMU"]),
  S("Odesa National Medical University","Ukraine","UA","Odesa",["ONMedU","Odessa National Medical University"]),
  S("Danylo Halytsky Lviv National Medical University","Ukraine","UA","Lviv",["LNMU","Lviv National Medical University"]),
  // United Kingdom gaps
  S("University of Glasgow School of Medicine, Dentistry and Nursing","United Kingdom","GB","Glasgow",["Glasgow Medical School"]),
  S("Queen's University Belfast School of Medicine, Dentistry and Biomedical Sciences","United Kingdom","GB","Belfast",["QUB Medicine"]),
  S("University of Dundee School of Medicine","United Kingdom","GB","Dundee",["Dundee Medical School"]),
  S("University of Southampton Faculty of Medicine","United Kingdom","GB","Southampton",["Southampton Medical School"]),
  S("University of Liverpool School of Medicine","United Kingdom","GB","Liverpool",["Liverpool Medical School"]),
  S("University of Leicester Medical School","United Kingdom","GB","Leicester",["Leicester Medical School"]),
  S("Warwick Medical School","United Kingdom","GB","Coventry",["University of Warwick Medical School"]),
  S("Peninsula Medical School, University of Plymouth","United Kingdom","GB","Plymouth",["Plymouth Medical School"]),
  S("Keele University School of Medicine","United Kingdom","GB","Newcastle-under-Lyme",["Keele Medical School"],{alternate_cities:["Keele"]}),
  S("University of Sunderland School of Medicine","United Kingdom","GB","Sunderland",[]),
  S("Anglia Ruskin University School of Medicine","United Kingdom","GB","Chelmsford",["ARU School of Medicine"]),
  S("University of Buckingham Medical School","United Kingdom","GB","Buckingham",[]),
  S("University of St Andrews School of Medicine","United Kingdom","GB","St Andrews",["St Andrews Medicine"]),
  S("King's College London GKT School of Medical Education","United Kingdom","GB","London",["KCL Medicine","Guy's, King's and St Thomas'","GKT"]),
  S("University of Sheffield Medical School","United Kingdom","GB","Sheffield",["Sheffield Medical School"]),
  S("University of Oxford Medical Sciences Division","United Kingdom","GB","Oxford",["Oxford Medical School"]),
  S("University of Cambridge School of Clinical Medicine","United Kingdom","GB","Cambridge",["Cambridge Medical School"]),
  S("University of Birmingham College of Medicine and Health","United Kingdom","GB","Birmingham",["Birmingham Medical School"]),
  S("University of Central Lancashire School of Medicine","United Kingdom","GB","Preston",["UCLan Medicine"]),
  S("Edge Hill University Medical School","United Kingdom","GB","Ormskirk",[]),
  S("Brunel Medical School","United Kingdom","GB","Uxbridge",["Brunel University London Medicine"]),
  S("University of Chester Medical School","United Kingdom","GB","Chester",[]),
  S("Lincoln Medical School","United Kingdom","GB","Lincoln",["University of Lincoln Medicine"]),
  S("Swansea University Medical School","United Kingdom","GB","Swansea",[]),
  S("North Wales Medical School, Bangor University","United Kingdom","GB","Bangor",["Bangor Medical School"]),
  S("Ulster University School of Medicine","United Kingdom","GB","Derry",["Ulster Medicine Magee"],{alternate_cities:["Londonderry"]}),
  S("University of Nottingham School of Medicine","United Kingdom","GB","Nottingham",["Nottingham Medical School"]),
  // Ireland
  S("RCSI University of Medicine and Health Sciences","Ireland","IE","Dublin",["Royal College of Surgeons in Ireland","RCSI"]),
  S("University of Limerick School of Medicine","Ireland","IE","Limerick",["UL Medicine"]),
  // Georgia / Nigeria gaps
  S("Tbilisi State Medical University","Georgia","GE","Tbilisi",["TSMU","Tbilisi State Medical"]),
  S("University of Ibadan College of Medicine","Nigeria","NG","Ibadan",["UI College of Medicine","Ibadan Medical School","COMUI"]),
  // Central Asia and neighbours
  S("Asfendiyarov Kazakh National Medical University","Kazakhstan","KZ","Almaty",["KazNMU","Kazakh National Medical University"]),
  S("Astana Medical University","Kazakhstan","KZ","Astana",["AMU Astana"]),
  S("Avicenna Tajik State Medical University","Tajikistan","TJ","Dushanbe",["TSMU","Tajik State Medical University"]),
  S("Kabul University of Medical Sciences","Afghanistan","AF","Kabul",["Kabul Medical University","KUMS"]),
  // Gulf
  S("King Saud University College of Medicine","Saudi Arabia","SA","Riyadh",["KSU Medicine"]),
  S("Alfaisal University College of Medicine","Saudi Arabia","SA","Riyadh",["Alfaisal Medicine"]),
  S("King Abdulaziz University Faculty of Medicine","Saudi Arabia","SA","Jeddah",["KAU Medicine"]),
  S("University of Sharjah College of Medicine","United Arab Emirates","AE","Sharjah",["UoS Medicine"]),
  S("Mohammed Bin Rashid University of Medicine and Health Sciences","United Arab Emirates","AE","Dubai",["MBRU"]),
  S("Gulf Medical University","United Arab Emirates","AE","Ajman",["GMU Ajman"]),
  S("Weill Cornell Medicine – Qatar","Qatar","QA","Doha",["WCM-Q","Weill Cornell Qatar"]),
  S("Sultan Qaboos University College of Medicine and Health Sciences","Oman","OM","Muscat",["SQU Medicine"])
];

/* Overrides for Wikidata records whose identity is right but whose label or city is not
   how students know them. Keyed by the record's canonical_school_id in the Wikidata file. */
const OVERRIDES={
  aliases:{
    "St George's, University of London":["SGUL","St George's London"],
    "Saint George's University School of Medicine":["SGU","St. George's University","St George's University Grenada","SGU Grenada"],
    "American University of Antigua":["AUA","AUA College of Medicine","American University of Antigua College of Medicine"],
    "Ross University School of Medicine":["RUSM","Ross"],
    "University of Pécs Medical School":["POTE","PTE ÁOK","Pécsi Tudományegyetem Általános Orvostudományi Kar","University of Pecs"],
    "University of Szeged Albert Szent-Györgyi Medical School":["SZTE ÁOK","Szegedi Tudományegyetem","University of Szeged"],
    "Medical College of Jagiellonian University":["Jagiellonian University Medical College","UJ CM","Collegium Medicum UJ"],
    "Poznań University of Medical Sciences":["PUMS","Poznan University of Medical Sciences"],
    "Medical University of Gdańsk":["GUMed","MUG"],
    "Medical University of Silesia":["SUM Katowice","Śląski Uniwersytet Medyczny"],
    "Wrocław Medical University":["UMW","Wroclaw Medical University"],
    "Medical University of Białystok":["UMB","Medical University of Bialystok"],
    "First Faculty of Medicine, Charles University":["1. LF UK","Charles University First Faculty"],
    "Second Faculty of Medicine – Charles University":["2. LF UK","Charles University Second Faculty"],
    "Third Faculty of Medicine, Charles University":["3. LF UK","Charles University Third Faculty"],
    "Masaryk University Faculty of Medicine":["MUNI MED","Lékařská fakulta Masarykovy univerzity"],
    "Medical Faculty of Comenius University in Bratislava":["Comenius University Faculty of Medicine","LF UK Bratislava"],
    "Faculty of Medicine, Pavol Jozef Šafárik University in Košice":["UPJŠ LF","Kosice Faculty of Medicine"],
    "Jessenius Faculty of Medicine":["JFMED CU","Jessenius Faculty of Medicine in Martin"],
    "School of Medicine, Trinity College Dublin":["TCD Medicine","Trinity College Dublin School of Medicine"],
    "University College Dublin School of Medicine and Medical Science":["UCD School of Medicine","UCD Medicine"],
    "University College Cork School of Medicine":["UCC Medicine"],
    "National University of Ireland Galway College of Medicine Nursing and Health Sciences":["University of Galway School of Medicine","NUI Galway Medicine"],
    "The Faculty of Medicine of Iași":["UMF Iași Faculty of Medicine","Grigore T. Popa Faculty of Medicine"],
    "University of Medicine and Pharmacy of Târgu Mureș":["UMFST Târgu Mureș","George Emil Palade University of Medicine, Pharmacy, Science, and Technology of Târgu Mureș","UMF Tirgu Mures"],
    "University of Medicine and Pharmacy of Craiova":["UMF Craiova"],
    "Ovidius University":["Ovidius University of Constanța Faculty of Medicine","UOC Medicine"],
    "Trinity School of Medicine":["Trinity Medical Sciences University","Trinity St. Vincent"],
    "Saint Matthew's University School of Medicine":["SMU Cayman","St. Matthew's University"],
    "Windsor University School of Medicine":["WUSOM"],
    "All Saints University School of Medicine":["All Saints Dominica"],
    "Zaporizhzhia State Medical and Pharmaceutical University":["ZSMU","Zaporozhye State Medical University","Zaporizhzhia State Medical University"],
    "UNAM Faculty of Medicine":["Universidad Nacional Autónoma de México Facultad de Medicina","National Autonomous University of Mexico"],
    "Ignacio A. Santos School of Medicine":["Tecnológico de Monterrey School of Medicine","TEC Salud","ITESM Medicina"],
    "University of Padua. School of Medicine and Surgery":["Università degli Studi di Padova","Padova","University of Padova"],
    "Lund University Faculty of Medicine":["Lunds universitet Medicinska fakulteten"],
    "Medical Faculty at Umeå University":["Umeå University Faculty of Medicine"],
    "Vilnius University Faculty of Medicine":["VU MF","Vilniaus universitetas Medicinos fakultetas"],
    "David Tvildiani Medical University":["DTMU","AIETI Medical School"],
    "Petre Shotadze Tbilisi Medical Academy":["TMA Tbilisi"],
    "Caucasus International University Faculty of Medicine":["CIU Medicine"],
    "Cebu Doctors' University College of Medicine":["CDU Medicine"],
    "Ateneo de Manila University Ateneo School of Medicine and Public Health":["ASMPH","Ateneo Medicine"],
    "Manila Central University":["MCU Medicine"],
    "American University of Beirut Faculty of Medicine":["AUB Faculty of Medicine","AUB Medicine","AUBFM"],
    "Tehran University of Medical Sciences":["TUMS"],
    "Cairo University Kasr Alainy  Faculty of Medicine":["Kasr Al Ainy","Kasr El Aini","Cairo University Faculty of Medicine"],
    "Faculty of Medicine, Ain Shams University":["Ain Shams Medicine"],
    "Faculty of Medicine, Alexandria University":["Alexandria Faculty of Medicine"],
    "University of Lagos College of Medicine":["CMUL","Unilag Medicine"],
    "Dow Medical College":["DMC Karachi","Dow University of Health Sciences"],
    "Aga Khan University Medical College Pakistan":["AKU Karachi","Aga Khan University"],
    "Institute of Medicine, Nepal":["IOM Nepal","Tribhuvan University Institute of Medicine","Maharajgunj Medical Campus"]
  },
  cities:{
    "Trinity School of Medicine":"Ratho Mill",
    "Zaporizhzhia State Medical and Pharmaceutical University":"Zaporizhzhia",
    "Saint George's University School of Medicine":"St. George's",
    "Saint Matthew's University School of Medicine":"George Town",
    "Faculty of Medicine in Pilsen, Charles University":"Plzeň",
    "Medical Faculty of Slovak Medical University in Bratislava":"Bratislava",
    "Gdańsk Medical School":"Gdańsk",
    "Medical School in Warsaw":"Warsaw",
    "Silesian Medical School in Katowice":"Katowice",
    "University of Pécs Medical School":"Pécs",
    "Ross University School of Medicine":"Bridgetown",
    "University of Belgrade Faculty of Medicine":"Belgrade",
    "Faculty of Pharmacy of the University of Medicine and Pharmacy \"Grigore T. Popa\" from Iasi":"Iași",
    "University of Medicine and Pharmacy of Craiova":"Craiova",
    "University of Medicine and Pharmacy of Târgu Mureș":"Târgu Mureș"
  }
};

const slug=(value)=>String(value).normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const records=SCHOOLS.map((school)=>({
  canonical_school_id:`mm-school-curated-${slug(school.name)}`,
  canonical_name:school.name,
  alternate_names:school.aliases,
  country:school.country,
  country_code:school.code,
  state_or_region:"",
  city:school.city,
  school_type:"Medical school",
  source:"MissionMed curated IMG supplement",
  source_identifier:`curated:${slug(school.name)}`,
  source_url_or_reference:"",
  accreditation_body:"",
  active_status_if_known:null,
  dataset_version:DATASET_VERSION,
  verified_at:"",
  verification_status:"curated-identity-unverified-accreditation",
  normalization_status:"identity-curated-accreditation-not-asserted",
  analytics_eligible:false,
  wikidata_qid:null,
  alternate_cities:school.alternate_cities||[]
}));
const ids=new Set();
for(const record of records){
  if(ids.has(record.canonical_school_id))throw new Error(`duplicate id ${record.canonical_school_id}`);
  ids.add(record.canonical_school_id);
}
const countries=[...new Set(records.map((record)=>record.country))].sort();
const payload={
  manifest:{
    schema_version:1,
    dataset_version:DATASET_VERSION,
    retrieved_at:"2026-09-05T00:00:00.000Z",
    kind:"curated-supplement",
    coverage:{record_count:records.length,country_count:countries.length,countries,excludes_united_states:true,completeness_status:"not asserted"},
    source:{
      name:"MissionMed curated IMG supplement",
      selection:"Identity-only records for medical schools that MissionMed students commonly attend and that the Wikidata 'medical school' class query does not return (universities whose medicine faculty has no separate Wikidata item), plus alias/city overrides for existing Wikidata identities.",
      license:"MissionMed internal reference data; identity facts only"
    },
    overrides:{
      by_canonical_name:{
        aliases:OVERRIDES.aliases,
        cities:OVERRIDES.cities
      }
    },
    verification_law:{identity_only:true,accreditation_asserted:false,active_status_asserted:false,analytics_eligible:false,unlisted_path_required:true},
    limitations:[
      "Curated identities are not Wikidata-backed; each was added because a real student query returned no result.",
      "A match establishes only an identity; it never verifies accreditation, active status, eligibility, or degree authority.",
      "Overrides only add aliases or correct a city on an existing Wikidata identity; they never change its canonical id."
    ]
  },
  records
};
const body=JSON.stringify(payload,null,2);
payload.manifest.integrity={records_sha256:createHash("sha256").update(JSON.stringify(records)).digest("hex")};
await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(payload,null,2)+"\n");
console.log(`${out}: ${records.length} records, ${countries.length} countries, ${Object.keys(OVERRIDES.aliases).length} alias overrides, ${Object.keys(OVERRIDES.cities).length} city overrides (${body.length} bytes)`);
