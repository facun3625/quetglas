-- AlterTable
ALTER TABLE "AiConversation" ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminSeenAt" TIMESTAMP(3);


-- Lo que ya existe no cuenta como "nuevo": los pedidos anteriores se dan por vistos y las conversaciones guardadas
-- conservan su fecha real de último mensaje.
UPDATE "Order" SET "adminSeenAt" = NOW();
UPDATE "AiConversation" SET "lastMessageAt" = "updatedAt";
