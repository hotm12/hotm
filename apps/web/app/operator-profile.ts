"use client";

export type OperatorRole = "ADMIN" | "OPERATOR" | "REVIEWER" | "VIEWER";

export type OperatorProfile = {
  name: string;
  role: OperatorRole;
};

export const operatorProfileStorageKey = "seller-find-operator-profile";

export const defaultOperatorProfile: OperatorProfile = {
  name: "Local Operator",
  role: "ADMIN"
};

export function loadOperatorProfile(): OperatorProfile {
  if (typeof window === "undefined") {
    return defaultOperatorProfile;
  }

  try {
    const raw = window.localStorage.getItem(operatorProfileStorageKey);

    if (!raw) {
      return defaultOperatorProfile;
    }

    const parsed = JSON.parse(raw) as Partial<OperatorProfile>;

    return {
      name: parsed.name?.trim() || defaultOperatorProfile.name,
      role: parsed.role ?? defaultOperatorProfile.role
    };
  } catch {
    return defaultOperatorProfile;
  }
}

export function saveOperatorProfile(profile: OperatorProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(operatorProfileStorageKey, JSON.stringify(profile));
}

export function canWriteWithRole(role: OperatorRole) {
  return role !== "VIEWER";
}
