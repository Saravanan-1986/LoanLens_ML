"""Supplementary hand-written consumer loan clauses (part 2).

Extends :mod:`training.loan_corpus` with more lending vocabulary so the
classifier sees enough loan-domain supervision. Same labels/definitions.
"""

from __future__ import annotations

NORMAL_EXTRA: list[str] = [
    "The sanction letter discloses the loan amount, tenure, interest rate and all charges before the Borrower signs this Agreement.",
    "The disbursed amount shall be credited only to the bank account of the Borrower mentioned in the application form.",
    "The Borrower may obtain a free copy of the executed loan documents within fifteen days of disbursement on written request.",
    "The annualised rate, total interest payable and total amount repayable are disclosed in the schedule to this Agreement.",
    "The Borrower shall be given at least seven working days to read and understand the terms before signing.",
    "The Lender shall publish its schedule of charges on its website and display it at its branches.",
    "The Borrower may repay a floating rate loan early after six months without any foreclosure charge.",
    "The Lender shall acknowledge every payment with a receipt sent to the registered email address and mobile number.",
    "The Borrower shall be informed of the due date, instalment amount and outstanding balance through monthly statements.",
    "The Lender shall reverse any amount wrongly debited within five working days of the error being established.",
    "The Borrower may nominate a person to receive loan information if the Borrower is unavailable.",
    "The Lender shall close the auto-debit mandate within seven working days of full repayment.",
    "The Borrower may approach the grievance officer and then the ombudsman if a complaint remains unresolved.",
    "The Lender shall not discriminate between borrowers except on published risk criteria.",
    "The Lender shall release the mortgaged property documents within thirty days of full repayment.",
    "The Borrower shall receive a key fact statement summarising the cost of the loan in simple language.",
    "Recovery staff shall identify themselves and carry valid authorisation letters during visits.",
    "Interest shall cease to accrue from the date the full outstanding amount is received by the Lender.",
    "The Lender shall inform the credit bureaus of closure within thirty days of full repayment.",
    "The Borrower is entitled to an amortisation schedule showing principal and interest of each instalment.",
    "The Lender shall obtain explicit consent before sharing personal data for marketing purposes.",
    "The Borrower shall be given a reasonable opportunity to remedy a default before recovery action starts.",
    "The Lender shall consider restructuring requests sympathetically in genuine financial hardship.",
    "The Borrower shall be informed in writing of any recovery agent appointment with contact particulars.",
    "Recovery visits shall occur only between sunrise and sunset with due respect to privacy.",
    "The Lender shall provide a foreclosure statement within five working days of a request.",
    "The Borrower shall receive closure confirmation at the registered address within fifteen working days.",
    "The Borrower may seek clarification of any clause and the Lender shall explain it in simple language.",
    "The Lender shall keep documents in safe custody and return them upon closure of the loan.",
    "The Borrower shall be informed of any assignment at least fifteen days before it takes effect.",
    "The Borrower may substitute the security with another acceptable security with approval of the Lender.",
    "The Lender shall ensure a guarantee is invoked only after the Borrower has had an opportunity to pay.",
    "The Borrower may inspect title documents of the mortgaged property at the branch during working hours.",
    "The Lender shall maintain a record of recovery communications for a period of three years.",
    "The Borrower may verify authorisation of any representative by calling the registered helpline.",
    "The Lender shall provide reasonable assistance for understanding tax implications of the loan.",
    "The Borrower may contact the helpline on working days for queries on the loan account.",
    "The Lender shall not publish a defaulter name without following the prescribed procedure.",
]

NEEDS_REVIEW_EXTRA: list[str] = [
    "The Lender may revise the interest rate from time to time in line with its cost of funds after intimating the Borrower.",
    "The Borrower agrees to pay enforcement costs incurred by the Lender in connection with the security.",
    "The Lender may review the credit facilities yearly and modify the terms thereof.",
    "The Borrower shall inform the Lender of any material change in employment or income during the tenure.",
    "The Lender may engage collection agencies for overdue amounts and the Borrower shall cooperate with them.",
    "The Borrower agrees that the Lender may obtain credit reports periodically during the currency of the loan.",
    "The instalment may be revised upon a change in the benchmark rate and the Borrower shall pay the revised amount.",
    "The Lender may stipulate additional conditions before disbursement including execution of supplementary documents.",
    "The Borrower shall maintain the hypothecated asset in good condition and not sell it without approval.",
    "The Borrower shall submit income proof and bank statements as the Lender may call for every twelve months.",
    "The Lender may permit postponement of up to two instalments a year subject to additional interest.",
    "Notices sent by registered post to the last known address shall be deemed duly served on the Borrower.",
    "The Lender may transfer servicing of the loan to another entity with due notice to the Borrower.",
    "Prepayment shall be subject to the terms prevailing on the date of prepayment as communicated by the Lender.",
    "The Borrower acknowledges that missed payments may attract dishonour charges and affect the credit score.",
    "The Lender may call for a discussion if two consecutive instalments remain unpaid.",
    "The Borrower shall execute an updated repayment schedule whenever the tenure is restructured.",
    "Any dispute on interest computation shall first go to the grievance redressal officer of the Lender.",
    "The Borrower shall bear insurance premium for the financed asset failing which the Lender may arrange cover.",
    "The Borrower agrees to inform the Lender before taking additional borrowing above the sanctioned threshold.",
    "The Lender may revise the repayment schedule following any regulatory direction and the Borrower shall comply.",
    "The Borrower acknowledges that delay in repayment may affect the credit score maintained by bureaus.",
    "The Lender may levy a nominal charge for duplicate statements or foreclosure letters.",
    "The Borrower shall comply with reasonable directions relating to end use of the loan amount.",
    "The Lender shall act on instructions from any one co-borrower unless contrary written instructions arrive.",
    "The Borrower shall notify the Lender within seven days of any loss of or damage to the security.",
    "The Borrower shall cooperate with the Lender during any audit or inspection of the loan account.",
    "The Lender may require salary account maintenance with the Lender for the tenure of the loan.",
    "The Borrower shall pay charges for cheques returned unpaid for want of sufficient funds.",
]

RISKY_EXTRA: list[str] = [
    "The Lender may revise the rate at its sole discretion and the Borrower shall be bound without any right to object.",
    "The Borrower assigns all present and future receivables to the Lender as continuing security until dues are realized.",
    "The entire loan with interest becomes payable immediately if a single cheque is dishonoured for any reason.",
    "The Borrower shall deposit undated signed cheques which the Lender may fill and present for any amount at any time.",
    "The Lender may enter the residence of the Borrower at any hour to repossess the asset upon a single default.",
    "The Borrower forfeits any right to approach a court and shall submit to arbitration by the nominee of the Lender.",
    "The Borrower shall pay compounded penal interest at three percent per month on overdue amounts until realization.",
    "The Lender may publicly disclose the default including photographs without further intimation to the Borrower.",
    "The Borrower authorises direct deduction of shortfalls from salary credited to any account of the Borrower.",
    "Margin money and processing fees shall be non-refundable under all circumstances including rejection.",
    "The Lender may extend tenure and increase total interest without fresh consent from the Borrower.",
    "The Lender may appoint a receiver with power to sell the security without court recourse at the cost of the Borrower.",
    "Even a one day delay entitles the Lender to enforce all securities simultaneously as time is of the essence.",
    "The Borrower shall not leave the country without written permission until the loan is fully repaid.",
    "The certificate of dues issued by the Lender shall be final, binding and unchallengeable in any proceedings.",
    "The Borrower shall pledge additional assets whenever demanded failing which the loan becomes immediately repayable.",
    "Pledged gold may be sold privately without auction or valuation upon even a short delay in repayment.",
    "The Borrower consents to continuous location tracking through the mobile application until closure of the loan.",
    "Penal charges may be debited retrospectively from disbursement upon any covenant breach.",
    "The Lender may enforce the personal guarantee before proceeding against the Borrower at its absolute choice.",
    "The Lender may recall the entire loan if the credit score falls below an undisclosed internal threshold.",
    "The Borrower shall bear actual litigation costs including advocate fees without any cap.",
    "Dues may be set off against deposits of family members without prior consent of the Borrower.",
    "The Lender may refuse prepayment and interest shall continue for the full contracted tenure.",
    "Default under any affiliate agreement automatically constitutes default under this Agreement.",
    "The Borrower waives statutory borrower protections and agrees not to invoke regulatory relief.",
    "Only electronic records of the Lender constitute evidence and paper records need not be produced.",
    "Penal charges apply even during the moratorium and shall be capitalised into the principal.",
    "The guarantor shall pay on first demand without remedies against the Borrower being exhausted.",
]

EXTRA_CORPUS: list[tuple[str, str]] = (
    [(text, "Normal") for text in NORMAL_EXTRA]
    + [(text, "Needs Review") for text in NEEDS_REVIEW_EXTRA]
    + [(text, "Risky") for text in RISKY_EXTRA]
)


