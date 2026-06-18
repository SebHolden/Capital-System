import { issueCsrfToken } from "@/lib/security/csrf";

export async function GET() {
  const { response } = await issueCsrfToken();
  return response;
}
