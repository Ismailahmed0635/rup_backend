-- CreateTable
CREATE TABLE "BankPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT,
    "bank_account_name" TEXT NOT NULL,
    "bank_account_number" TEXT NOT NULL,
    "bank_routing_number" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "BankPayment_payment_id_key" ON "BankPayment"("payment_id");

-- CreateIndex
CREATE INDEX "BankPayment_store_id_idx" ON "BankPayment"("store_id");

-- CreateIndex
CREATE INDEX "BankPayment_payment_id_idx" ON "BankPayment"("payment_id");

-- CreateIndex
CREATE INDEX "BankPayment_order_id_idx" ON "BankPayment"("order_id");
