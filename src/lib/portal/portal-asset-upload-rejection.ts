export function recoverExpectedPortalAssetUploadRejection({
  error,
  onInvalidAsset,
}: {
  error: unknown;
  onInvalidAsset: () => void;
}) {
  if (!(error instanceof Error) || error.message !== "invalid_asset") {
    return false;
  }

  onInvalidAsset();
  return true;
}
