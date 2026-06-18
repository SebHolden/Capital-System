import { prisma } from "@/lib/db";
import { JournalClient } from "@/components/journal/JournalClient";

export default async function JournalPage() {
  const journals = await prisma.tradeJournal.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <JournalClient
      initialJournals={journals.map((j) => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
      }))}
    />
  );
}
