-- Link loans to wallet money flow.
-- deduct: whether this loan reduced your spendable money (created a Loan expense).
-- lend_tx_id / repay_tx_id: the linked transactions so we can clean them up
-- when the loan is deleted or un-settled.
alter table loans add column if not exists deduct boolean not null default false;
alter table loans add column if not exists lend_tx_id uuid;
alter table loans add column if not exists repay_tx_id uuid;
