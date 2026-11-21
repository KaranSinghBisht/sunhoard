import { describe, expect, it } from "vitest";
import { resetTxLog, useTxLog } from "../src/chain/txlog";

describe("tx log", () => {
  it("keeps the newest row first", () => {
    resetTxLog();
    useTxLog.getState().add({ instruction: "gather", signature: "a", latencyMs: 10, url: "", ok: true });
    useTxLog.getState().add({ instruction: "post_position", signature: "b", latencyMs: 4, url: "", ok: true });
    expect(useTxLog.getState().rows.map((row) => row.instruction)).toEqual(["post_position", "gather"]);
  });
});
