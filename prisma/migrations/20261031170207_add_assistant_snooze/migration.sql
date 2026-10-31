-- CreateTable
CREATE TABLE "AssistantSnooze" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSnooze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSnooze_userId_alertKey_key" ON "AssistantSnooze"("userId", "alertKey");

-- AddForeignKey
ALTER TABLE "AssistantSnooze" ADD CONSTRAINT "AssistantSnooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
