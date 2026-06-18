import { NextResponse } from "next/server";
import { simulateOrder } from "@/lib/execution";
import { simulateOrderSchema } from "@/lib/execution/schemas";
import { CsrfError, verifyCsrfRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    verifyCsrfRequest(request);
    const body = await request.json();
    const parsed = simulateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await simulateOrder(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_INVALID" },
        { status: 403 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Errore nella simulazione dell'ordine.", code: "SIMULATE_ERROR" },
      { status: 500 },
    );
  }
}
