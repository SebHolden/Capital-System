import { NextResponse } from "next/server";
import { resolvePortfolioAssetIds, resolvePricesForAssets } from "@/lib/prices";

export async function GET() {
  try {
    const assets = await resolvePortfolioAssetIds();
    const prices = await resolvePricesForAssets(assets);
    return NextResponse.json({ prices });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero prezzi.", code: "PRICES_FETCH_ERROR" },
      { status: 500 },
    );
  }
}
