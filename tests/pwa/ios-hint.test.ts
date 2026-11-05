import { describe, expect, it } from "vitest";
import { iosHintText, isIosSafari, shouldShowIosHint } from "@/lib/pwa/ios-hint";

// The "Add to Home Screen" hint is for iPhone and iPad Safari only, once, and not
// when the app is already opened from the home screen (ticket-35).

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const iphoneChrome =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const iphoneFirefox =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const ipadSafari =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const macSafari = ipadSafari;
const androidChrome =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("isIosSafari", () => {
  it("is true for iPhone Safari and for iPad Safari (which says it is a Mac, with a touch screen)", () => {
    expect(isIosSafari({ userAgent: iphoneSafari, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: ipadSafari, maxTouchPoints: 5 })).toBe(true);
  });

  it("is false for a real Mac, Android, and other iOS browsers", () => {
    expect(isIosSafari({ userAgent: macSafari, maxTouchPoints: 0 })).toBe(false);
    expect(isIosSafari({ userAgent: androidChrome, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: iphoneChrome, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: iphoneFirefox, maxTouchPoints: 5 })).toBe(false);
  });
});

describe("shouldShowIosHint", () => {
  const device = { userAgent: iphoneSafari, maxTouchPoints: 5, standalone: false };

  it("shows once on iOS Safari", () => {
    expect(shouldShowIosHint(device, false)).toBe(true);
  });

  it("stays hidden once dismissed", () => {
    expect(shouldShowIosHint(device, true)).toBe(false);
  });

  it("stays hidden when the app is already opened from the home screen", () => {
    expect(shouldShowIosHint({ ...device, standalone: true }, false)).toBe(false);
  });

  it("stays hidden elsewhere", () => {
    expect(shouldShowIosHint({ ...device, userAgent: androidChrome }, false)).toBe(false);
  });
});

describe("iosHintText", () => {
  it("says what to do in one sentence, without banned words", () => {
    expect(iosHintText).toMatch(/^[A-Z][^.]*\.$/);
    expect(iosHintText).not.toMatch(/please|successfully|click here/i);
  });
});
