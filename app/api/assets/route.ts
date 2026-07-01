import { NextResponse } from "next/server";
import { getAllAssets } from "@/lib/portfolio";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const assets = await getAllAssets();
    return NextResponse.json({ assets });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel recupero degli asset.", code: "ASSETS_FETCH_ERROR" },
      { status: 500 },
    );
  }
}
