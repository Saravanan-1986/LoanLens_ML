"""Generate a small, text-based sample loan agreement PDF.

Useful for exercising the full LoanLens pipeline without needing a real
document:

    python scripts/generate_sample_pdf.py
    python scripts/generate_sample_pdf.py --out samples/My_Agreement.pdf

The PDF is written with plain PDF syntax so no third party library is needed.
"""

from __future__ import annotations

import argparse
import os
from datetime import date

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
LINES_PER_PAGE = 46
FONT_SIZE = 10
LEFT_MARGIN = 56
TOP_Y = 780
LEADING = 15

HEADER = "PERSONAL LOAN AGREEMENT - SAMPLE DOCUMENT (generated for LoanLens testing)"

CLAUSES = [
    ("1. DEFINITIONS AND INTERPRETATION",
     ["In this Agreement, unless the context otherwise requires, the singular includes the",
      "plural and a reference to a person includes a body corporate."]),
    ("2. LOAN AMOUNT AND DISBURSEMENT",
     ["The Lender agrees to lend to the Borrower a sum of Rs. 5,00,000 (Rupees Five Lakh",
      "only) and the Borrower agrees to repay the same with interest. The Loan shall be",
      "disbursed to the Borrower's bank account within 2 working days of execution."]),
    ("3. INTEREST RATE",
     ["Interest shall be charged on the outstanding principal at the rate of 10.5% per",
      "annum, calculated on a reducing balance basis, and shall accrue from the date of",
      "disbursement until repayment in full."]),
    ("4. EFFECTIVE ANNUAL RATE",
     ["The Effective Annual Rate applicable to the Loan shall be as may be determined by",
      "the Lender from time to time, after taking into account the interest and all charges",
      "payable by the Borrower."]),
    ("5. PROCESSING FEE",
     ["A non-refundable processing fee of 2.5% of the Loan Amount, together with applicable",
      "taxes, shall be deducted from the disbursement amount at the time of disbursement."]),
    ("6. REPAYMENT SCHEDULE",
     ["The Borrower shall repay the Loan in 24 equated monthly instalments of Rs. 23,190",
      "each, commencing on the 5th day of the month following the month of disbursement."]),
    ("7. PREPAYMENT CHARGES",
     ["The Borrower shall pay a prepayment charge of 5% of the outstanding principal amount",
      "in the event that the Borrower prepays or forecloses the Loan, whether in part or in",
      "full, prior to the completion of the Loan Term."]),
    ("8. PENAL INTEREST",
     ["In the event of default in payment of any instalment, penal interest at the rate of",
      "2% per month shall be charged on the overdue amount and shall be compounded on a",
      "monthly basis until the default is cured."]),
    ("9. AUTO-DEBIT MANDATE",
     ["The Borrower hereby irrevocably authorises the Lender to debit the Borrower's bank",
      "account through NACH or any other mode for all amounts due under this Agreement",
      "without further notice to the Borrower."]),
    ("10. RECOVERY AND CONTACT PERSONS",
     ["In the event of default, the Borrower agrees that the Lender, its employees or its",
      "recovery agents may contact the reference persons mentioned in the schedule, the",
      "Borrower's family members and the Borrower's employer to recover the outstanding",
      "dues."]),
    ("11. REVISION OF INTEREST RATE",
     ["The Lender may at its sole discretion revise the rate of interest and other charges",
      "under this Agreement at any time without any prior notice to the Borrower."]),
    ("12. SECURITY CHEQUE",
     ["The Borrower shall, at the time of execution of this Agreement, hand over a signed",
      "blank cheque drawn on the Borrower's bank account as security, which the Lender may",
      "present in the event of default."]),
    ("13. CROSS DEFAULT",
     ["Any default by the Borrower in the repayment of any other loan, facility or agreement",
      "with the Lender shall be deemed to be an event of default under this Agreement."]),
    ("14. ACCELERATION ON DEFAULT",
     ["Upon the occurrence of an event of default, the entire outstanding principal together",
      "with accrued interest and other charges shall become immediately due and payable by",
      "the Borrower."]),
    ("15. SHARING OF INFORMATION",
     ["The Borrower authorises the Lender to disclose the Borrower's personal information",
      "and credit details to third parties, affiliates and credit information companies as",
      "the Lender may deem necessary."]),
    ("16. GOVERNING LAW AND JURISDICTION",
     ["This Agreement shall be governed by the laws of India and the courts at Mumbai shall",
      "have exclusive jurisdiction in respect of all disputes arising out of or in connection",
      "with this Agreement."]),
    ("17. STATEMENTS AND NOTICES",
     ["The Lender shall provide the Borrower with a statement of account on a monthly basis.",
      "Any notice under this Agreement shall be sent to the address or email address recorded",
      "with the Lender."]),
    ("18. GRIEVANCE REDRESSAL",
     ["The Borrower may raise any complaint in relation to the Loan by writing to the",
      "Grievance Redressal Officer of the Lender. The Lender shall endeavour to resolve the",
      "complaint within 30 days."]),
    ("19. INSURANCE",
     ["The Borrower may, at the Borrower's option, obtain insurance in respect of the Loan.",
      "Any premium payable for such insurance shall be borne by the Borrower."]),
    ("20. NOMINATION",
     ["The Borrower may nominate a person in the schedule to receive any benefit payable",
      "under the Loan in the event of the death of the Borrower."]),
]

def build_lines() -> list[str]:
    lines = [HEADER, ""]
    lines.append(f"Executed on {date.today().isoformat()}")
    lines.append("")
    for heading, body in CLAUSES:
        lines.append(heading)
        lines.extend(body)
        lines.append("")
    lines.append("This document is a generated sample used for testing LoanLens.")
    return lines


def escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build_content_stream(lines: list[str]) -> bytes:
    parts = ["BT", f"/F1 {FONT_SIZE} Tf", f"{LEADING} TL", f"{LEFT_MARGIN} {TOP_Y} Td"]
    for line in lines:
        parts.append(f"({escape(line)}) Tj")
        parts.append("T*")
    parts.append("ET")
    return "\n".join(parts).encode("latin-1", errors="replace")


def paginate(lines: list[str]) -> list[list[str]]:
    pages = [lines[i : i + LINES_PER_PAGE] for i in range(0, len(lines), LINES_PER_PAGE)]
    return pages or [[""]]


def build_pdf() -> bytes:
    pages = paginate(build_lines())
    page_count = len(pages)

    objects: list[bytes] = []
    first_page_obj = 4  # 1: catalog, 2: pages, 3: font
    font_obj = 3

    kids = " ".join(f"{first_page_obj + index * 2} 0 R" for index in range(page_count))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode("latin-1"))
    objects.append(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )

    for index, page_lines in enumerate(pages):
        page_obj = first_page_obj + index * 2
        content_obj = page_obj + 1
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {font_obj} 0 R >> >> /Contents {content_obj} 0 R >>"
            ).encode("latin-1")
        )
        stream = build_content_stream(page_lines)
        objects.append(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )

    output = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for obj_number, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output += f"{obj_number} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"

    xref_offset = len(output)
    total = len(objects) + 1
    output += f"xref\n0 {total}\n".encode("latin-1")
    output += b"0000000000 65535 f \n"
    for offset in offsets:
        output += f"{offset:010d} 00000 n \n".encode("latin-1")

    output += (
        f"trailer\n<< /Size {total} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    ).encode("latin-1")

    return bytes(output)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a sample loan agreement PDF for LoanLens."
    )
    parser.add_argument(
        "--out",
        default=os.path.join("samples", "Sample_Loan_Agreement.pdf"),
        help="output path (default: samples/Sample_Loan_Agreement.pdf)",
    )
    args = parser.parse_args()

    directory = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(directory, exist_ok=True)

    with open(args.out, "wb") as handle:
        handle.write(build_pdf())

    print(f"Wrote {args.out} ({os.path.getsize(args.out)} bytes)")


if __name__ == "__main__":
    main()
