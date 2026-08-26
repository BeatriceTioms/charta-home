-- Charta Home · an agency's own details on its own receipts
--
-- The printed receipt carried a street address, an email and a registration
-- number that belonged to nobody: they were demo values in the interface, and
-- every agency's receipt showed the same fabricated ones. A receipt is a
-- document a tenant keeps and may produce later, so putting another company's
-- address and an invented RCCM number on it is worse than leaving them off.
--
-- These are the fields a receipt actually needs and the agencies table did not
-- carry. All optional: an agency that has not filled them in gets a receipt
-- without those lines, rather than a receipt with somebody else's.

alter table agencies
  add column if not exists address text,
  add column if not exists email citext,
  add column if not exists registration text;

comment on column agencies.address is
  'Street address as it should appear on a receipt.';
comment on column agencies.registration is
  'Company registration, RCCM in Guinea. Printed on receipts when present.';
