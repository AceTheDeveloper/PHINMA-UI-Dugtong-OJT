// The one-time "Add to Home Screen" hint for students on iPhone and iPad Safari
// (ticket-35). iOS has no install prompt, so people only find this by luck.

export const iosHintStorageKey = "dugtong-ios-hint-dismissed";

export type Device = {
  userAgent: string;
  // Touch points: iPadOS 13+ says it is a Mac, so the user agent alone is not enough.
  maxTouchPoints: number;
  // Already opened from the home screen.
  standalone: boolean;
};

// Only Safari can add to the home screen on older iOS, and its Share menu is the
// one the hint describes. Other iOS browsers get no hint.
export function isIosSafari({ userAgent, maxTouchPoints }: Pick<Device, "userAgent" | "maxTouchPoints">): boolean {
  const iPhoneOrIPad =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return iPhoneOrIPad && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
}

export function shouldShowIosHint(device: Device, dismissed: boolean): boolean {
  return isIosSafari(device) && !device.standalone && !dismissed;
}

export const iosHintText = "Add Dugtong to your home screen: tap Share, then Add to Home Screen.";
