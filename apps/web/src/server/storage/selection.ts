import type { StorageConnection } from "./types";

export interface StorageConnectionRoles {
  primary: StorageConnection | null;
  fallback: StorageConnection | null;
}

/**
 * Primary is the connection an admin marked default (or the first one).
 * Fallback is the one marked fallback, otherwise any other connection.
 */
export function selectStorageConnections(
  connections: readonly StorageConnection[],
): StorageConnectionRoles {
  const primary = connections.find((connection) => connection.isDefault) ?? connections[0] ?? null;
  const fallback =
    connections.find((connection) => connection.isFallback && connection.id !== primary?.id) ??
    connections.find((connection) => connection.id !== primary?.id) ??
    null;
  return { primary, fallback };
}

/** Upload order: primary first, then fallback, then everything else. */
export function orderedStorageConnections(
  connections: readonly StorageConnection[],
): StorageConnection[] {
  const { primary, fallback } = selectStorageConnections(connections);
  return [
    ...(primary ? [primary] : []),
    ...(fallback && fallback.id !== primary?.id ? [fallback] : []),
    ...connections.filter(
      (connection) => connection.id !== primary?.id && connection.id !== fallback?.id,
    ),
  ];
}
