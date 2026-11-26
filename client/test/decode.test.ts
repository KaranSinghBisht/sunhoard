import { Connection } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { arenaPhase } from "../src/chain/arenaView";
import { openProgram } from "../src/chain/program";
import { readPack } from "../src/chain/watch";
import { useHud } from "../src/ui/store";

/** An account as the rollup returns it: the discriminator, then zeroed data. */
function blank(program: ReturnType<typeof openProgram>, name: string, size: number): Buffer {
  const account = program.idl.accounts?.find((entry) => entry.name === name);
  if (!account) throw new Error(`the IDL has no ${name} account`);
  return Buffer.concat([Buffer.from(account.discriminator), Buffer.alloc(size)]);
}

describe("reading accounts off the rollup", () => {
  const program = openProgram(new Connection("http://127.0.0.1:1"));

  it("decodes the pack, so the HUD is never left blank", () => {
    readPack(program, blank(program, "inventory", 12_000));
    expect(useHud.getState().stacks).toBe(0);
  });

  it("decodes the arena: an idle one is neither fighting nor waiting", () => {
    const idle = arenaPhase(program, blank(program, "arena", 4_000));
    expect(idle).toEqual({ fight: null, lair: null, waiting: false });
    const waiting = blank(program, "arena", 4_000);
    waiting[8 + modeOffset(program)] = 1;
    expect(arenaPhase(program, waiting).waiting).toBe(true);
  });
});

/** Where `mode` sits in Arena, counted from the IDL so a layout change cannot hide a broken decode. */
function modeOffset(program: ReturnType<typeof openProgram>): number {
  const sizes: Record<string, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, u64: 8, i64: 8, pubkey: 32 };
  const arena = program.idl.types?.find((type) => type.name === "arena");
  if (!arena || arena.type.kind !== "struct" || !Array.isArray(arena.type.fields)) throw new Error("no Arena type");
  let offset = 0;
  for (const entry of arena.type.fields as Array<{ name: string; type: unknown }>) {
    if (entry.name === "mode") return offset;
    if (typeof entry.type === "string") offset += sizes[entry.type];
    else if (typeof entry.type === "object" && entry.type && "array" in entry.type) {
      const [of, count] = (entry.type as { array: [string, number] }).array;
      offset += sizes[of] * count;
    } else throw new Error(`unsized field ${entry.name}`);
  }
  throw new Error("Arena has no mode");
}
