import '@testing-library/jest-dom';

// jsdom does not implement the Blob URL registry. ImageCropModal,
// UploadPreviewImage (Task FF, 2026-07-30) and DashChatView all call
// `URL.createObjectURL` / `URL.revokeObjectURL` directly — without a stub,
// any test that mounts one of those crashes with "URL.createObjectURL is
// not a function" the instant it renders, rather than exercising the
// component at all. A counting stub (not just a no-op) lets a test assert a
// create is paired with a revoke.
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = jest.fn(() => `blob:mock-${++counter}`);
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = jest.fn();
}
