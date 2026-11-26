import { describe, expect, it } from "vitest";
import { checkAccountPrivacy, checkCallbackPrivacy } from "../scripts/privacy";

const yes = async () => true;
const no = async () => false;
const offline = async (): Promise<boolean> => { throw new Error("RPC unavailable"); };

for (const [name, check] of Object.entries({ account: checkAccountPrivacy, callback: checkCallbackPrivacy })) {
  describe(name, () => {
    it("requires a working positive control and a hidden result", async () => {
      await expect(check(yes, no)).resolves.toBeUndefined();
      await expect(check(no, no)).rejects.toThrow();
      await expect(check(yes, yes)).rejects.toThrow();
      await expect(check(offline, no)).rejects.toThrow("RPC unavailable");
      await expect(check(yes, offline)).rejects.toThrow("RPC unavailable");
    });
  });
}
