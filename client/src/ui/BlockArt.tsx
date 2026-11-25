import { useMemo } from "react";
import { renderBlockDataUrl, renderShellDataUrl, type BlockSpec } from "../art/blocks";

export function BlockArt({
  spec,
  size = 32,
  px = 64,
  className = "",
}: {
  spec: BlockSpec;
  size?: number;
  px?: 16 | 64;
  className?: string;
}) {
  const src = useMemo(() => renderBlockDataUrl(spec, px), [spec.tone, spec.grade, spec.purityBp, spec.pattern, px]);
  if (!src) return null;
  return <img className={`pixel-art ${className}`} src={src} width={size} height={size} alt="" />;
}

export function ShellArt({
  shell,
  size = 32,
  px = 64,
  className = "",
}: {
  shell: number;
  size?: number;
  px?: 16 | 64;
  className?: string;
}) {
  const src = useMemo(() => renderShellDataUrl(shell, px), [shell, px]);
  if (!src) return null;
  return <img className={`pixel-art ${className}`} src={src} width={size} height={size} alt="" />;
}
