-- Signature Documents feature (kz.eco.signaturedoc): the signing flow must compare the IIN
-- embedded in the signer's CMS certificate against the staff user's own linked IIN
-- (CERTIFICATE_OWNER_MISMATCH / CERTIFICATE_PROFILE_NOT_LINKED business rules). kz.eco.user.User
-- had no IIN field (bin is the company's BIN, unrelated) - additive, nullable column only, no
-- behavior change to any existing User usage.
ALTER TABLE users ADD COLUMN iin VARCHAR(20) NULL;
