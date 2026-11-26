// A private RPC URL is a bearer credential. A rollup receipt stays in the player's own client.
export function explorerUrl(signature: string, layer: "base" | "rollup", _endpoint?: string): string {
  return layer === "base" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : "";
}

export function rollupEndpoint(base: string, token: string): string {
  const endpoint = new URL(base);
  endpoint.searchParams.set("token", token);
  return endpoint.toString();
}
