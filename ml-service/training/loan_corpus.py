"""A compact, hand written corpus of consumer loan agreement clauses.

The public datasets the model learns from are mostly commercial contracts and
online terms of service. This corpus injects real lending vocabulary
(instalments, foreclosure, NACH, penal interest, blank cheque security, credit
bureau reporting ...) so the classifier transfers well to retail loan
agreements.

Every entry is ``(clause_text, label)`` where ``label`` is one of
``Normal`` / ``Needs Review`` / ``Risky``. The wording deliberately mirrors the
LoanLens rulebook so the model and the rules reinforce each other, while the
labels follow the same definitions used across the product.
"""

from __future__ import annotations

NORMAL: list[str] = [
    "The Lender shall disburse the loan amount to the Borrower's bank account within two working days of the execution of this Agreement.",
    "The Borrower shall repay the loan in twenty four equal monthly instalments commencing one month from the date of disbursement.",
    "The interest rate applicable to this loan is 12% per annum, fixed for the entire tenure of the loan.",
    "The Lender shall issue a statement of account to the Borrower every month setting out the amounts due and the amounts paid.",
    "Either party may terminate this Agreement by giving thirty days prior written notice to the other party.",
    "All notices under this Agreement shall be sent to the address or email address recorded with the Lender.",
    "This Agreement shall be governed by the laws of India and the courts at Mumbai shall have exclusive jurisdiction.",
    "The Borrower may prepay the loan in whole or in part after giving the Lender seven days prior written notice, without any prepayment charge.",
    "The processing fee payable under this Agreement is 2% of the loan amount and is stated in the schedule of charges.",
    "The Borrower shall inform the Lender in writing of any change in residential address, email address or telephone number.",
    "The Lender shall give the Borrower a copy of this Agreement and the schedule of charges at the time of disbursement.",
    "Interest for the first month shall be calculated from the date of disbursement to the last day of that calendar month.",
    "The Borrower may nominate a co-applicant with the prior written consent of the Lender.",
    "Payments made by the Borrower shall first be applied to interest and thereafter to principal.",
    "The Lender shall send reminders to the Borrower seven days before each instalment due date.",
    "The Borrower shall maintain adequate insurance on the vehicle financed under this Agreement and provide proof of renewal to the Lender.",
    "If the Borrower pays the entire outstanding balance before the due date, no additional interest shall be charged for the remaining period.",
    "The Lender shall provide a no dues certificate to the Borrower within thirty days of the closure of the loan account.",
    "The Borrower shall be entitled to receive a statement of interest paid for the purpose of claiming any tax benefit available under law.",
    "The rate of interest is fixed at 10.5% per annum and shall not be varied during the term of the loan.",
    "The Borrower shall repay the loan together with interest by standing instruction from the bank account nominated in the schedule.",
    "Any part payment received from the Borrower shall be acknowledged in writing by the Lender within three working days.",
    "The Lender shall provide the Borrower with contact details of the grievance redressal officer in accordance with applicable directions.",
    "If the Borrower is unable to pay an instalment due to reasons beyond the Borrower's control, the Borrower may request a review of the repayment schedule.",
    "The co-applicant is jointly and severally liable with the Borrower for the repayment of the loan.",
    "This Agreement shall come into force on the date of disbursement and shall remain in force until the loan is repaid in full.",
    "The Borrower shall be given a period of fifteen days from the due date to pay an instalment before the account is reported as overdue.",
    "The Lender shall not levy any charge that is not disclosed in the schedule of charges attached to this Agreement.",
    "The Borrower is entitled to a full refund of any amount collected in excess of the amounts stated in the schedule of charges.",
    "The loan account shall be closed and a no objection certificate issued once the Borrower has paid all amounts due under this Agreement.",
    "The Borrower may request a change of the instalment due date once during the tenure of the loan without any charge.",
    "The Lender shall keep confidential all information relating to the Borrower and shall use it only for the purposes of this Agreement.",
    "The Borrower shall be entitled to receive a copy of the credit information report relied upon by the Lender at the time of sanction.",
    "The Lender shall inform the Borrower of the outstanding balance on request at no charge once in every two months.",
    "The interest rate shall be reduced in line with any reduction in the reference rate notified by the Lender from time to time.",
    "The Borrower may close the loan account on any working day by paying the outstanding principal and interest accrued up to the date of closure.",
    "The Lender shall communicate any change in the schedule of charges to the Borrower at least thirty days before the change takes effect.",
    "Nomination facilities shall be available to the Borrower and the nominee shall be recorded in the loan file.",
    "The Borrower has read and understood the terms of this Agreement and has had the opportunity to seek independent advice.",
    "The Borrower's signature on the schedule of charges confirms receipt of a copy of the schedule.",
]

NEEDS_REVIEW: list[str] = [
    "The interest rate applicable to the loan shall be as may be determined by the Lender from time to time after taking into account market conditions.",
    "The Lender may revise the charges applicable to this loan subject to change.",
    "The Borrower agrees to pay such additional charges as may be notified by the Lender from time to time.",
    "The loan may be recalled at the discretion of the Lender.",
    "The Lender shall be entitled to set off any amounts due under this Agreement against any balance standing to the credit of any account of the Borrower.",
    "The Borrower shall furnish such further documents and information as the Lender may reasonably require.",
    "The Lender may at its discretion permit or refuse part payment of the loan.",
    "Interest shall be charged at the rate notified by the Lender on the loan outstanding as on the last day of each month.",
    "The Borrower shall pay interest on the amount in arrears at the rate applicable to the loan until the arrears are cleared.",
    "The Lender may require the Borrower to provide additional security if the value of the existing security falls materially.",
    "Any waiver by the Lender of a breach shall be effective only if given in writing and shall not be a waiver of any other breach.",
    "The terms of this Agreement may be modified if required by any applicable law or direction of a regulator.",
    "The Lender may revise the instalment amount following a change in the rate of interest and shall notify the Borrower accordingly.",
    "The Borrower shall bear the charges levied by the Borrower's bank in respect of the standing instruction.",
    "The Lender may disclose the existence of the loan to any credit information company in accordance with applicable law.",
    "The Borrower agrees that the Lender may share information relating to this loan with its group companies for administrative purposes.",
    "The decision of the Lender on the computation of amounts due shall ordinarily be accepted by the Borrower save for manifest error.",
    "The Borrower shall not create any charge or encumbrance over the security without the prior written consent of the Lender.",
    "The Lender may appoint a third party servicer to collect instalments on its behalf.",
    "The Borrower shall give the Lender immediate notice of any event that may materially affect the ability of the Borrower to repay the loan.",
    "If the loan is recalled, the Borrower shall pay the outstanding amount within such period as the Lender may allow.",
    "The Lender may require the Borrower to open and maintain a salary account with the Lender for the tenure of the loan.",
    "The Borrower shall be charged a fee for any cheque or standing instruction returned unpaid for want of sufficient funds.",
    "The Lender may require the Borrower to provide a guarantor acceptable to the Lender prior to disbursement.",
    "Any change in the constitution of the Borrower's business shall be intimated to the Lender and may require the Lender's consent.",
    "The Lender's books of account shall be maintained in the ordinary course and the Borrower may inspect the loan statement on request.",
    "The Lender may recover reasonable incidental expenses incurred in connection with the loan.",
    "The Borrower shall ensure that the proceeds of the loan are used only for the purpose stated in the loan application.",
    "The Borrower shall cooperate with the Lender in the event of any audit or inspection of the loan account.",
    "The Lender may, if it considers it necessary, seek a fresh credit information report on the Borrower during the tenure of the loan.",
    "The Borrower acknowledges that any delay in repayment may affect the Borrower's credit score.",
    "The Lender may consider a request for restructuring of the loan on such terms as it may decide, subject to applicable policy.",
    "The Borrower shall keep the asset financed under this Agreement in good working condition and permit inspection on reasonable notice.",
    "The Lender may deduct from the loan proceeds any amount payable by the Borrower under this Agreement.",
    "Interest on overdue instalments shall be payable at a rate higher than the normal rate by not more than the limit permitted by applicable law.",
    "The Borrower agrees to abide by such process and documentation requirements as the Lender may notify from time to time.",
    "The Lender may decline a request for prepayment if it is made during the fixed rate period, subject to the terms of the schedule.",
    "The Borrower shall not sub-let or part with possession of the security without the prior consent of the Lender.",
    "The Lender may send communications to the Borrower by email, short message service or post, and such communications shall be deemed received on dispatch.",
    "The Borrower shall pay the applicable stamp duty and other statutory levies in connection with this Agreement.",
]


RISKY: list[str] = [
    "The Lender may, at its sole discretion and without prior notice, revise the interest rate at any time during the tenure of the loan.",
    "The Borrower irrevocably authorises the Lender to debit the Borrower's bank account through NACH or any other mode for all amounts due under this Agreement without further notice to the Borrower.",
    "The Borrower shall hand over a signed blank cheque as security for the loan, which the Lender may present at its discretion.",
    "In the event of default the Lender shall be entitled to charge penal interest at 24% per annum compounded monthly on the outstanding amount.",
    "The Borrower waives all rights of objection and shall not dispute the statements of account furnished by the Lender, which shall be treated as conclusive evidence of the amounts due.",
    "The Lender may disclose the Borrower's personal and financial information to any third party without the consent of the Borrower.",
    "The Borrower shall be liable for all costs of recovery including the charges of recovery agents, whether or not any legal proceeding is filed.",
    "The Lender may assign, transfer or novate the loan, the security and all related obligations to any third party without notice to or consent from the Borrower.",
    "The Borrower waives the right to receive notice before foreclosure and agrees that possession of the security may be taken immediately on default.",
    "Breach of any term, including delay in payment of a single instalment, shall constitute an event of default entitling the Lender to demand immediate repayment of the entire outstanding balance.",
    "The Borrower hereby irrevocably consents to the sharing of the Borrower's data, including credit information, with the Lender's affiliates, agents and service providers for an indefinite period.",
    "The Lender may, without notice, adjust, combine or transfer any account of the Borrower and may retain any security until all claims are satisfied.",
    "The Borrower agrees that the Lender may call upon the guarantor to pay any amount at any time at the Lender's sole discretion and without exhausting its remedies against the Borrower.",
    "The Borrower agrees that the Lender shall not be liable for any loss, damage or injury arising from the exercise of its rights under this Agreement.",
    "The Borrower shall not raise any dispute, claim or objection in relation to the interest, charges or amounts debited by the Lender at any time hereafter.",
    "The Borrower agrees that the Lender may change the frequency of instalments or the repayment schedule without the consent of the Borrower.",
    "Any amount outstanding after the due date shall bear additional interest compounded at the Lender's prevailing rate as determined solely by the Lender.",
    "The Borrower waives the right to receive notice of any assignment of the loan and of any change in the ownership of the Lender.",
    "The Borrower shall indemnify the Lender against all claims, losses and expenses of whatsoever nature and howsoever arising, including claims that are not attributable to any act or omission of the Borrower.",
    "In the event of default the Lender may seize, take possession of and sell the security without any notice to the Borrower and without any order of any court.",
    "The Borrower authorises the Lender to disclose details of the loan and of the Borrower's account to the Borrower's employer, guarantor and any other person at the sole discretion of the Lender.",
    "The Lender may appropriate any amounts received from the Borrower towards any dues whatsoever, in such order and manner as the Lender may determine, without reference to the Borrower.",
    "The Borrower agrees that the Lender may recover from the Borrower all expenses, including legal expenses calculated on a full indemnity basis, incurred for the enforcement of this Agreement.",
    "The Borrower consents to receiving communications at all hours from the Lender, its agents and recovery agencies at the contact details provided.",
    "The Borrower shall not, without the prior written consent of the Lender, prepay or foreclose the loan, and any such foreclosure shall attract a charge of 8% of the principal outstanding.",
    "The Lender may terminate this Agreement at any time and for any reason without incurring any liability, and the entire outstanding amount shall become payable forthwith.",
    "The Borrower agrees that the record of the Lender, in the absence of manifest error, shall be conclusive and binding on the Borrower for all purposes and shall not be challenged in any forum.",
    "The Borrower waives the right to a trial and agrees that all disputes shall be referred to arbitration at the sole option of the Lender, with the seat and venue chosen by the Lender.",
    "The Borrower agrees to pay a penal charge of Rs. 1,000 per day for every day of delay in payment of any instalment, in addition to interest on the overdue amount.",
    "The Borrower irrevocably undertakes not to dispute, at any time, the statements of account, the rate of interest or the amounts claimed by the Lender.",
    "The Borrower agrees that the loan may be recalled immediately upon the death, insolvency or change of employment of the Borrower without any notice to the Borrower's legal heirs.",
    "The Borrower agrees that the Lender may process and store the Borrower's biometric data and all personal information for the purposes of credit assessment and recovery of the loan.",
    "The Borrower shall, if called upon, provide additional security or a guarantor, failing which the entire loan shall become immediately repayable with penal charges.",
    "Any dispute between the parties shall be referred to the sole arbitrator appointed by the Lender and the award of the arbitrator shall be final and binding on the Borrower.",
    "The Borrower agrees that the Lender may recover from the Borrower any amount paid by the Lender to any credit information company or service provider in connection with this loan.",
    "The Borrower hereby authorises the Lender and its representatives to enter upon the premises of the Borrower at any time for the purpose of inspecting the security.",
    "The Borrower waives any right to receive a notice of dishonour or of non-payment and agrees that the Lender may initiate proceedings immediately upon default.",
    "The Borrower agrees that all payments made by the Borrower may be adjusted by the Lender against any other loan or facility of the Borrower in any manner the Lender may deem fit.",
    "The Borrower shall be liable to pay the outstanding amount together with interest, charges and expenses in the event that the Lender recalls the loan at its sole discretion.",
    "The Borrower agrees that the interest rate may be increased by the Lender at any time and any such increase shall be binding on the Borrower without further notice or consent.",
]

#: The corpus as ``(text, label)`` pairs.
LOAN_CORPUS: list[tuple[str, str]] = (
    [(text, "Normal") for text in NORMAL]
    + [(text, "Needs Review") for text in NEEDS_REVIEW]
    + [(text, "Risky") for text in RISKY]
)


def corpus_stats() -> dict:
    """Small helper used by the dataset builder for reporting."""
    return {
        "total": len(LOAN_CORPUS),
        "Normal": len(NORMAL),
        "Needs Review": len(NEEDS_REVIEW),
        "Risky": len(RISKY),
    }

