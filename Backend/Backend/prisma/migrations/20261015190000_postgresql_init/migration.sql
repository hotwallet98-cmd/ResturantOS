-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branches" JSONB NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Free',
    "nextOrderNo" INTEGER NOT NULL DEFAULT 1001,
    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "restaurantId" TEXT,
    "riderId" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "station" TEXT NOT NULL,
    "prepMins" INTEGER NOT NULL,
    "veg" BOOLEAN NOT NULL,
    "available" BOOLEAN NOT NULL,
    "variants" JSONB NOT NULL,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiningTable" (
    "restaurantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "shape" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "guests" INTEGER,
    "guestName" TEXT,
    "server" TEXT,
    "seatedAt" TIMESTAMP(3),
    "billTotal" DOUBLE PRECISION,
    "reservedFor" TEXT,
    "billRequested" BOOLEAN NOT NULL DEFAULT false,
    "reservationId" TEXT,
    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("restaurantId", "id")
);

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "guest" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "party" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "tableId" TEXT,
    "area" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "occasion" TEXT,
    "notes" TEXT,
    "noShowRisk" DOUBLE PRECISION NOT NULL,
    "visits" INTEGER NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tableId" TEXT,
    "guests" INTEGER,
    "waiter" TEXT,
    "customer" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "predictedMins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "history" JSONB NOT NULL,
    "call" JSONB,
    "riderId" TEXT,
    "payOnDelivery" TEXT,
    "payment" JSONB,
    "paymentTxnId" TEXT,
    "remake" BOOLEAN NOT NULL DEFAULT false,
    "trackingToken" TEXT,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "station" TEXT NOT NULL,
    "modifiers" JSONB NOT NULL,
    "notes" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_riderId_key" ON "User"("riderId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "Reservation_restaurantId_idx" ON "Reservation"("restaurantId");
CREATE INDEX "Rider_restaurantId_idx" ON "Rider"("restaurantId");
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
CREATE UNIQUE INDEX "Order_restaurantId_orderNo_key" ON "Order"("restaurantId", "orderNo");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
