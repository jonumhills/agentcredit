/**
 * Lightweight offchain name registry.
 * Maps wallet address (lowercase) → agent name.
 * Stored in memory; persists for the lifetime of the Railway service.
 */

const names = new Map<string, string>();

export function setName(wallet: string, name: string) {
  if (name?.trim()) names.set(wallet.toLowerCase(), name.trim());
}

export function getName(wallet: string): string | undefined {
  return names.get(wallet.toLowerCase());
}

export function getAllNames(): Record<string, string> {
  return Object.fromEntries(names);
}
