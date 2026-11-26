/** The caller validates the public account's owner and discriminator. Unknown RPC errors propagate. */
export async function checkAccountPrivacy(
  publicSeasonExists: () => Promise<boolean>,
  worldIsVisible: () => Promise<boolean>,
): Promise<void> {
  if (!(await publicSeasonExists())) throw new Error("Public Season control unavailable.");
  if (await worldIsVisible()) throw new Error("Private World was visible.");
}

/** The operator supplies the signature of a successful salt callback from their validator record. */
export async function checkCallbackPrivacy(
  knownSuccessful: () => Promise<boolean>,
  visible: () => Promise<boolean>,
): Promise<void> {
  if (!(await knownSuccessful())) throw new Error("Callback inclusion could not be confirmed.");
  if (await visible()) throw new Error("Private callback transaction was visible.");
}
