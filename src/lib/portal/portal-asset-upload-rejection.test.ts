import { expect, mock, test } from "bun:test";
import { recoverExpectedPortalAssetUploadRejection } from "./portal-asset-upload-rejection";

test("recovers an invalid asset upload rejection without rethrowing it", async () => {
  const restoreUploadState = mock(() => undefined);
  const showInvalidAssetError = mock(() => undefined);

  const interaction = Promise.reject(new Error("invalid_asset")).catch(
    (error) => {
      if (
        recoverExpectedPortalAssetUploadRejection({
          error,
          onInvalidAsset: () => {
            restoreUploadState();
            showInvalidAssetError();
          },
        })
      ) {
        return;
      }
      throw error;
    },
  );

  await expect(interaction).resolves.toBeUndefined();
  expect(restoreUploadState).toHaveBeenCalledTimes(1);
  expect(showInvalidAssetError).toHaveBeenCalledTimes(1);
});

test("does not recover unexpected upload failures", () => {
  const restoreUploadState = mock(() => undefined);

  expect(
    recoverExpectedPortalAssetUploadRejection({
      error: new Error("asset_finalization_failed"),
      onInvalidAsset: restoreUploadState,
    }),
  ).toBeFalse();
  expect(restoreUploadState).not.toHaveBeenCalled();
});
