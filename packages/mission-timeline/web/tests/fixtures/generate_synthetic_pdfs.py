#!/usr/bin/env python3
"""Generate synthetic-only D1-408 PDF fixtures. No real student data is used."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdfs"
MANIFEST = ROOT / "fixture_manifest_408.json"
LABEL = "SYNTHETIC FIXTURE - NO REAL PERSON - D1-408"


def write_pdf(name: str, pages: list[list[str]]) -> Path:
    path = PDF_DIR / name
    pdf = canvas.Canvas(str(path), pagesize=letter, pageCompression=1)
    width, height = letter
    for page_number, lines in enumerate(pages, start=1):
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(48, height - 36, LABEL)
        pdf.setFont("Helvetica", 7)
        pdf.drawRightString(width - 48, height - 36, f"PAGE {page_number}")
        y = height - 62
        for line in lines:
            if line.isupper() and len(line) < 55:
                pdf.setFont("Helvetica-Bold", 11)
            else:
                pdf.setFont("Helvetica", 9)
            pdf.drawString(48, y, line)
            y -= 18
            if y < 48:
                break
        pdf.showPage()
    pdf.save()
    return path


def write_scanned_pdf(name: str) -> Path:
    image_path = ROOT / "_scanned_fixture_page.png"
    image = Image.new("RGB", (1275, 1650), "white")
    draw = ImageDraw.Draw(image)
    draw.text((80, 80), LABEL, fill="black")
    draw.text((80, 150), "SCANNED CURRICULUM VITAE", fill="black")
    draw.text((80, 220), "WORK EXPERIENCE", fill="black")
    draw.text((80, 280), "June 2021 - August 2021 | Clinical Observership | Synthetic Hospital", fill="black")
    image.save(image_path)
    path = PDF_DIR / name
    pdf = canvas.Canvas(str(path), pagesize=letter)
    pdf.drawImage(str(image_path), 0, 0, width=letter[0], height=letter[1])
    pdf.showPage()
    pdf.save()
    image_path.unlink()
    return path


def write_password_pdf(name: str) -> Path:
    plain = write_pdf("_password_plain.pdf", [["CURRICULUM VITAE", "WORK EXPERIENCE", "2021 | Synthetic Role | Synthetic Hospital"]])
    reader = PdfReader(str(plain))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt("synthetic-only")
    path = PDF_DIR / name
    with path.open("wb") as handle:
        writer.write(handle)
    plain.unlink()
    return path


def scenario(scenario_id: str, files: list[str], expected: list[str], notes: str, expected_status: str = "READY_FOR_REVIEW") -> dict:
    return {
        "id": scenario_id,
        "files": files,
        "synthetic": True,
        "deidentified": True,
        "expectedStatus": expected_status,
        "expectedCanonicalTypes": expected,
        "notes": notes,
    }


def main() -> None:
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    write_pdf(
        "synthetic_eras_clean.pdf",
        [
            [
                "ELECTRONIC RESIDENCY APPLICATION SERVICE",
                "AAMC ID: SYNTHETIC-408-0001",
                "MEDICAL EDUCATION",
                "Degree: Medical Degree",
                "Institution: Meridian International Medical School",
                "Graduation Date: May 2017",
                "POSTGRADUATE TRAINING",
                "Experience Type: Work",
                "Position: House Officer",
                "Organization: Meridian Teaching Hospital",
                "Location: Accra, Ghana",
                "Dates: June 2017 - July 2019",
            ],
            [
                "EXAMINATIONS",
                "Exam: USMLE Step 1",
                "Date: March 2020",
                "Exam: USMLE Step 2 CK",
                "Date: August 2020",
                "CERTIFICATIONS",
                "Certification: ECFMG Certified",
                "Date: October 2020",
                "EXPERIENCES",
                "Experience Type: Observership",
                "Position: Internal Medicine Rotation",
                "Organization: Starlight Teaching Hospital",
                "Location: Newark, NJ",
                "Specialty: Internal Medicine",
                "Dates: June 2021 - August 2021",
            ],
            [
                "RESEARCH",
                "Experience Type: Research",
                "Position: Cardiology Research Assistant",
                "Organization: North River Cardiology Lab",
                "Dates: September 2021 - August 2022",
                "PUBLICATIONS",
                "Publication Title: Synthetic Outcomes Study",
                "Organization: Journal of Synthetic Medicine",
                "Date: June 2022",
            ],
        ],
    )

    write_pdf(
        "synthetic_cv_clean.pdf",
        [
            [
                "CURRICULUM VITAE",
                "EDUCATION",
                "May 2017 | Medical Degree | Meridian International Medical School | Accra, Ghana",
                "WORK EXPERIENCE",
                "June 2017 - July 2019 | House Officer | Meridian Teaching Hospital | Accra, Ghana",
                "EXAMINATIONS",
                "March 2020 | USMLE Step 1 | NBME",
                "June 2020 | USMLE Step 2 CK | NBME",
                "CLINICAL EXPERIENCE",
                "June 2021 - August 2021 | Internal Medicine Rotation | Starlight Hospital | Newark, NJ",
            ],
            [
                "RESEARCH EXPERIENCE",
                "September 2021 - August 2022 | Cardiology Research Assistant | North River Cardiology Lab",
                "PUBLICATIONS",
                "June 2022 | Synthetic Outcomes Study | Journal of Synthetic Medicine",
                "VOLUNTEER EXPERIENCE",
                "February 2021 - May 2021 | Clinical Volunteer | Harbor Family Clinic | Jersey City, NJ",
            ],
        ],
    )

    write_pdf(
        "synthetic_resume.pdf",
        [[
            "PROFESSIONAL SUMMARY",
            "Synthetic physician resume prepared only for D1-408 testing.",
            "EMPLOYMENT HISTORY",
            "January 2022 - Present | Medical Scribe | Harbor Health Group | New York, NY",
            "EDUCATION",
            "2017 | Medical Degree | Meridian International Medical School",
            "SKILLS",
            "Clinical documentation, research coordination, English and Spanish",
        ]],
    )

    duplicate_lines = [
        "EXPERIENCES",
        "Experience Type: Observership",
        "Position: Internal Medicine Observership",
        "Organization: Starlight Teaching Hospital",
        "Location: Newark, NJ",
        "Dates: June 2021 - August 2021",
    ]
    write_pdf("synthetic_duplicate_eras.pdf", [["ERAS APPLICATION", "AAMC ID: SYNTHETIC-DUP"] + duplicate_lines])
    write_pdf("synthetic_duplicate_cv.pdf", [["CURRICULUM VITAE", "CLINICAL EXPERIENCE", "June 2021 - August 2021 | Internal Medicine Observership | Starlight Hospital | Newark NJ"]])

    write_pdf("synthetic_conflict_eras.pdf", [["ERAS APPLICATION", "EXAMINATIONS", "Exam: Step 2 CK Preparation", "Dates: January 2020 - August 2020"]])
    write_pdf("synthetic_conflict_cv.pdf", [["CURRICULUM VITAE", "EXAMINATIONS", "January 2020 - June 2020 | Step 2 CK Preparation | Independent Study"]])

    write_pdf("synthetic_missing_date.pdf", [["CURRICULUM VITAE", "WORK EXPERIENCE", "Position: Medical Officer", "Organization: Synthetic Community Hospital", "Description: Dates were omitted from this source."]])
    write_pdf("synthetic_year_only.pdf", [["CURRICULUM VITAE", "WORK EXPERIENCE", "2019 | Medical Officer | Synthetic Community Hospital | Accra, Ghana"]])
    write_pdf("synthetic_usce_site.pdf", [["CURRICULUM VITAE", "CLINICAL EXPERIENCE", "June 2023 - August 2023 | Internal Medicine Observership | Harborview Teaching Hospital | Boston, MA"]])
    write_pdf("synthetic_research_publication.pdf", [["CURRICULUM VITAE", "RESEARCH EXPERIENCE", "September 2021 - August 2022 | Research Assistant | Synthetic Cardiology Lab", "PUBLICATIONS", "June 2022 | Synthetic Biomarker Study | Test Journal"]])
    write_pdf("synthetic_overlap.pdf", [["CURRICULUM VITAE", "WORK EXPERIENCE", "January 2020 - December 2020 | Rideshare Driver | Independent", "EXAMINATIONS", "January 2020 - August 2020 | Step 2 CK Preparation | Independent Study"]])
    write_pdf("synthetic_personal_family.pdf", [["CURRICULUM VITAE", "PERSONAL INFORMATION", "Spring 2021 | Parental leave for family reasons | Home"]])
    write_pdf("synthetic_sensitive.pdf", [["CURRICULUM VITAE", "ADDITIONAL INFORMATION", "March 2021 - May 2021 | Medical leave for a health condition | Private", "VISA STATUS", "October 2020 | Immigration work permit milestone | United States"]])
    write_scanned_pdf("synthetic_scanned_empty_text.pdf")

    corrupted = PDF_DIR / "synthetic_corrupted.pdf"
    corrupted.write_bytes(b"%PDF-1.7\nsynthetic intentionally corrupted xref\n")
    write_password_pdf("synthetic_password_protected.pdf")

    long_pages = []
    for page in range(1, 19):
        lines = ["CURRICULUM VITAE", "WORK EXPERIENCE"]
        for item in range(1, 10):
            year = 2000 + page
            lines.append(f"January {year} - December {year} | Synthetic Role {page}-{item} | Synthetic Institution {item} | City, ST")
        long_pages.append(lines)
    write_pdf("synthetic_long_cv.pdf", long_pages)

    write_pdf("synthetic_mixed_language.pdf", [["CURRICULUM VITAE", "EXPERIENCIA PROFESIONAL", "Junio 2019 - Julio 2020 | Medical Officer | Hospital Sintetico", "RESEARCH EXPERIENCE", "January 2021 - June 2021 | Research Assistant | Synthetic Lab"]])
    write_pdf("synthetic_unknown_layout.pdf", [["SYNTHETIC PROFILE", "2020: Community support project", "May 2021 | Unlabeled chronology item | Unknown Organization"]])

    scenarios = [
        scenario("clean_eras_native_text", ["synthetic_eras_clean.pdf"], ["MEDICAL_DEGREE", "INTERNSHIP_HOUSE_OFFICER", "STEP_1", "STEP_2_CK", "ECFMG_CERTIFICATION", "OBSERVERSHIP", "RESEARCH_EXPERIENCE", "PUBLICATION"], "Clean ERAS-style native-text PDF with three pages."),
        scenario("traditional_cv", ["synthetic_cv_clean.pdf"], ["MEDICAL_DEGREE", "INTERNSHIP_HOUSE_OFFICER", "STEP_1", "STEP_2_CK", "USCE_TEACHING_HOSPITAL", "RESEARCH_EXPERIENCE", "PUBLICATION", "VOLUNTEER_EXPERIENCE"], "Traditional CV layout."),
        scenario("resume_style", ["synthetic_resume.pdf"], ["WORK_EXPERIENCE", "MEDICAL_DEGREE"], "Resume-style headings and open-ended work range."),
        scenario("two_document_duplicate", ["synthetic_duplicate_eras.pdf", "synthetic_duplicate_cv.pdf"], ["OBSERVERSHIP"], "Same observership appears in ERAS and CV."),
        scenario("step_2_ck_conflict", ["synthetic_conflict_eras.pdf", "synthetic_conflict_cv.pdf"], ["USMLE_STUDY_PERIOD"], "Step 2 CK preparation end dates disagree."),
        scenario("missing_date", ["synthetic_missing_date.pdf"], ["WORK_EXPERIENCE"], "Candidate exists but date is missing and cannot be accepted."),
        scenario("year_only", ["synthetic_year_only.pdf"], ["WORK_EXPERIENCE"], "Year precision must remain explicit."),
        scenario("usce_site_name", ["synthetic_usce_site.pdf"], ["OBSERVERSHIP"], "USCE institution and city/state extraction."),
        scenario("research_publication_chain", ["synthetic_research_publication.pdf"], ["RESEARCH_EXPERIENCE", "PUBLICATION"], "Research duration plus publication milestone."),
        scenario("work_exam_overlap", ["synthetic_overlap.pdf"], ["WORK_EXPERIENCE", "USMLE_STUDY_PERIOD"], "Work and exam preparation overlap."),
        scenario("personal_family", ["synthetic_personal_family.pdf"], ["PERSONAL_NOT_ON_CV"], "Family context requires privacy review."),
        scenario("sensitive_private", ["synthetic_sensitive.pdf"], ["PERSONAL_NOT_ON_CV", "VISA_IMMIGRATION_MILESTONE"], "Health and immigration sensitivity flags."),
        scenario("scanned_empty_text", ["synthetic_scanned_empty_text.pdf"], [], "Image-only PDF.", "OCR_REQUIRED"),
        scenario("corrupted_pdf", ["synthetic_corrupted.pdf"], [], "Intentionally malformed PDF.", "CORRUPTED"),
        scenario("password_protected", ["synthetic_password_protected.pdf"], [], "Password is synthetic-only.", "PASSWORD_REQUIRED"),
        scenario("long_cv", ["synthetic_long_cv.pdf"], ["WORK_EXPERIENCE"], "Eighteen-page native-text stress fixture."),
        scenario("mixed_language", ["synthetic_mixed_language.pdf"], ["RESEARCH_EXPERIENCE"], "Spanish heading plus English event line."),
        scenario("unknown_layout", ["synthetic_unknown_layout.pdf"], ["UNCLASSIFIED"], "Unknown/mixed layout with conservative fallback."),
    ]

    payload = {
        "schemaVersion": "d1-408-fixtures-1",
        "generatedBy": "generate_synthetic_pdfs.py",
        "containsRealStudentData": False,
        "allFixturesSynthetic": True,
        "fixtureDirectory": str(PDF_DIR),
        "scenarios": scenarios,
    }
    MANIFEST.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"generatedPdfs": len(list(PDF_DIR.glob("*.pdf"))), "scenarios": len(scenarios), "manifest": str(MANIFEST)}))


if __name__ == "__main__":
    main()
