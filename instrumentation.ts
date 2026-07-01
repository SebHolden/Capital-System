export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnvOrExit } = await import(
      "@/lib/deployment/validateEnv"
    );
    assertProductionEnvOrExit();
  }
}
