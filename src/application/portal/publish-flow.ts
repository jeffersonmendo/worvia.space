export class PortalPublishFailure extends Error {
  constructor(
    readonly stage: "autosave" | "publish",
    options: { cause: unknown },
  ) {
    super(`portal_${stage}_failed`, options);
    this.name = "PortalPublishFailure";
  }
}

export async function publishPortalAfterAutosave<T>(
  flush: () => Promise<void>,
  publish: () => Promise<T>,
) {
  try {
    await flush();
  } catch (cause) {
    throw new PortalPublishFailure("autosave", { cause });
  }

  try {
    return await publish();
  } catch (cause) {
    throw new PortalPublishFailure("publish", { cause });
  }
}
