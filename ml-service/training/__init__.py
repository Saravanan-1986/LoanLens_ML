"""Training package for the LoanLens clause risk model.

The model is trained on a combination of:

* ``coastalcph/lex_glue`` **unfair_tos** - expert annotated unfair consumer
  contract clauses (CLAUDETTE).
* ``theatticusproject/cuad`` - expert annotated commercial/credit contract
  clauses grouped into named categories.
* :mod:`training.loan_corpus` - a small, hand written corpus of consumer loan
  agreement clauses that anchors the model on lending vocabulary.

Run ``python -m training.build_dataset`` then ``python -m training.train_classifier``
from the ``ml-service`` directory.
"""
