'use strict';

/**
 * Mongoose schema for a LoanLens account.
 *
 * Only the salted password hash is ever stored - the plaintext password is
 * discarded the moment the account is created. `passwordHash`/`passwordSalt`
 * are stripped in `toJSON` so they can never leak through an API response.
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    role: { type: String, default: 'Borrower' },
    lastLoginAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.passwordSalt;
        return ret;
      }
    }
  }
);

// The `unique: true` flag on the email field above already creates this index;
// declaring it twice makes Mongoose emit a duplicate-index warning on boot.
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
