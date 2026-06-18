import { ResearchClient } from "@/components/research/ResearchClient";
import { buildResearchSummary } from "@/lib/research";

export default async function ResearchPage() {
  const initial = await buildResearchSummary();

  return <ResearchClient initial={initial} />;
}
