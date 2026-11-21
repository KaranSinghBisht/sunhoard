export function explorerUrl(signature: string, layer: "base" | "rollup", rollupEndpoint: string): string {
  if (layer === "base") {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  }
  const custom = encodeURIComponent(rollupEndpoint);
  return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${custom}`;
}

export function rollupEndpoint(base: string, token: string): string {
  return `${base}?token=${token}`;
}
