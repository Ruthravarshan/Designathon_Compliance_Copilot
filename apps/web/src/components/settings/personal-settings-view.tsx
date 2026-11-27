"use client";

import { useState } from "react";
import { CheckCircle, EnvelopeSimple, SignOut, WarningCircle } from "@phosphor-icons/react";
import { AppearanceSelector } from "@/components/theme/theme-toggle";
import type { ThemeMode } from "@/components/theme/theme";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/status-badge";

export interface EmailCategoryPreference {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface PersonalSettingsActor {
  name: string;
  email: string | null;
  title?: string | null;
  avatarUrl?: string | null;
  role: string;
  departmentName?: string | null;
  authMethodLabel: string;
  isDemo: boolean;
  isGuest: boolean;
  canEditName?: boolean;
  canEditTitle?: boolean;
}

export function PersonalSettingsView({
  actor,
  initialTheme,
  emailCategories,
  emailSuppressedReason,
  onSaveProfile,
  onSaveEmailPreferences,
  onSignOut,
}: {
  actor: PersonalSettingsActor;
  initialTheme: ThemeMode;
  emailCategories: readonly EmailCategoryPreference[];
  emailSuppressedReason?: string | null;
  onSaveProfile?: (patch: { name?: string; title?: string }) => Promise<{
    ok: boolean;
    error?: string;
    requestId?: string | null;
  }>;
  onSaveEmailPreferences?: (
    categories: Record<string, boolean>,
  ) => Promise<{ ok: boolean; error?: string; requestId?: string | null }>;
  onSignOut: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState(actor.name);
  const [title, setTitle] = useState(actor.title ?? "");
  const [profilePending, setProfilePending] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{
    kind: "success" | "error";
    message: string;
    requestId?: string | null;
  } | null>(null);

  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(emailCategories.map((item) => [item.key, item.enabled])),
  );
  const [emailPending, setEmailPending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    kind: "success" | "error";
    message: string;
    requestId?: string | null;
  } | null>(null);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const canEditProfile = Boolean((actor.canEditName || actor.canEditTitle) && onSaveProfile);

  const handleSignOutClick = async () => {
    setSigningOut(true);
    setSignOutError(null);
    const result = await onSignOut();
    setSigningOut(false);
    if (!result.ok) {
      setSignOutError(result.error ?? "Sign out failed. Try again.");
    }
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSaveProfile) {
      return;
    }
    setProfilePending(true);
    setProfileStatus(null);
    const result = await onSaveProfile({
      ...(actor.canEditName ? { name: name.trim() } : {}),
      ...(actor.canEditTitle ? { title: title.trim() } : {}),
    });
    setProfilePending(false);
    setProfileStatus(
      result.ok
        ? { kind: "success", message: "Profile updated." }
        : {
            kind: "error",
            message: result.error ?? "That didn't save. Try again.",
            requestId: result.requestId,
          },
    );
  };

  const handleEmailSave = async () => {
    if (!onSaveEmailPreferences) {
      return;
    }
    setEmailPending(true);
    setEmailStatus(null);
    const result = await onSaveEmailPreferences(prefs);
    setEmailPending(false);
    setEmailStatus(
      result.ok
        ? { kind: "success", message: "Email preferences saved." }
        : {
            kind: "error",
            message: result.error ?? "That didn't save. Try again.",
            requestId: result.requestId,
          },
    );
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <PageHeader
        title="Personal settings"
        subtitle="Manage your profile, interface appearance, and email preferences."
      />

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Avatar name={actor.name} avatarUrl={actor.avatarUrl} size="lg" />
            <div>
              <h2 className="text-base font-semibold text-fg">Profile</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RoleBadge role={actor.role} isGuest={actor.isGuest} />
                {actor.departmentName ? <Badge tone="outline">{actor.departmentName}</Badge> : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          <form onSubmit={(event) => void handleProfileSave(event)} className="space-y-4">
            <Field
              label="Display name"
              htmlFor="profile-name"
              hint={!actor.canEditName ? "Managed by your workspace directory." : undefined}
            >
              <Input
                id="profile-name"
                value={name}
                disabled={!actor.canEditName || profilePending}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>

            {actor.canEditTitle || actor.title ? (
              <Field label="Title" htmlFor="profile-title">
                <Input
                  id="profile-title"
                  value={title}
                  placeholder="Not set"
                  disabled={!actor.canEditTitle || profilePending}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="profile-email">
              <Input
                id="profile-email"
                value={actor.email ?? "No email (guest session)"}
                disabled
                readOnly
              />
            </Field>

            {profileStatus ? <InlineStatusFeedback status={profileStatus} /> : null}

            {canEditProfile ? (
              <div className="flex justify-end">
                <Button type="submit" pending={profilePending} pendingLabel="Saving...">
                  Save changes
                </Button>
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold text-fg">Appearance</h2>
            <p className="mt-0.5 text-xs text-muted">
              Persisted in your browser cookie without reloading the page.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <AppearanceSelector initialMode={initialTheme} />
        </CardBody>
      </Card>

      {/* Email preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <EnvelopeSimple
              size={18}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-support"
            />
            <div>
              <h2 className="text-base font-semibold text-fg">Email notifications</h2>
              <p className="mt-0.5 text-xs text-muted">
                Security, access changes, and remediation alerts are transactional and always
                enabled.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          {emailSuppressedReason ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/35 bg-danger/10 p-3 text-xs text-fg"
            >
              <span className="font-semibold">Delivery suppressed:</span> {emailSuppressedReason}
            </div>
          ) : null}

          {actor.isGuest ? (
            <p className="text-sm text-muted">
              Guest sessions have no email address and do not receive email notifications.
            </p>
          ) : emailCategories.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Transactional remediation alerts and review decisions are delivered to{" "}
              <span className="font-mono text-fg">{actor.email}</span> through the workspace outbox.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {emailCategories.map((category) => (
                <Switch
                  key={category.key}
                  id={`email-pref-${category.key}`}
                  label={category.label}
                  description={category.description}
                  checked={Boolean(prefs[category.key])}
                  disabled={emailPending}
                  onChange={(checked) => setPrefs((prev) => ({ ...prev, [category.key]: checked }))}
                  className="py-3"
                />
              ))}
            </div>
          )}

          {emailStatus ? <InlineStatusFeedback status={emailStatus} /> : null}

          {!actor.isGuest && emailCategories.length > 0 && onSaveEmailPreferences ? (
            <div className="flex justify-end pt-1">
              <Button
                pending={emailPending}
                pendingLabel="Saving..."
                onClick={() => void handleEmailSave()}
              >
                Save changes
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-base font-semibold text-fg">Session</h2>
            <p className="mt-0.5 text-xs text-muted">{actor.authMethodLabel}</p>
          </div>
          <Button
            variant="secondary"
            pending={signingOut}
            pendingLabel="Signing out..."
            onClick={() => void handleSignOutClick()}
          >
            <SignOut size={15} weight="bold" aria-hidden="true" />
            Sign out
          </Button>
        </CardHeader>
        {signOutError ? (
          <CardBody className="pt-0">
            <InlineStatusFeedback status={{ kind: "error", message: signOutError }} />
          </CardBody>
        ) : null}
      </Card>
    </div>
  );
}

function InlineStatusFeedback({
  status,
}: {
  status: { kind: "success" | "error"; message: string; requestId?: string | null };
}) {
  if (status.kind === "success") {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-xs font-medium text-brand dark:text-support"
      >
        <CheckCircle size={15} weight="fill" aria-hidden="true" />
        <span>{status.message}</span>
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 p-3 text-xs text-fg"
    >
      <WarningCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 text-danger" />
      <div className="space-y-0.5">
        <p>
          <span className="font-semibold">Error:</span> {status.message}
        </p>
        {status.requestId ? (
          <p className="font-mono text-muted">Request ID: {status.requestId}</p>
        ) : null}
      </div>
    </div>
  );
}
