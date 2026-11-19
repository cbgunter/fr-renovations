import { phoneDigits } from '@frr/shared';

export const telHref = (phone: string) => `tel:${phoneDigits(phone)}`;

/** sms: link with a pre-filled body. "?&body=" works on both iOS and Android. */
export const smsHref = (phone: string, body: string) => `sms:${phoneDigits(phone)}?&body=${encodeURIComponent(body)}`;

export const mapHref = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
