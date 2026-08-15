'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { LocationSettings } from '@/components/settings/LocationSettings';
import { UserSettings } from '@/components/settings/UserSettings';
import { TariffSettings } from '@/components/settings/TariffSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { useAuth } from '@/lib/auth';

type Tab = 'general' | 'notifications' | 'locations' | 'tariff' | 'users';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('general');

  // Admin-only sections are hidden outright rather than shown disabled — the
  // API enforces the same boundary, so this is presentation, not security.
  const tabs: { value: Tab; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'notifications', label: 'Notifications' },
    { value: 'locations', label: 'Locations' },
    ...(isAdmin
      ? ([
          { value: 'tariff', label: 'Tariff' },
          { value: 'users', label: 'Users' },
        ] as { value: Tab; label: string }[])
      : []),
  ];

  return (
    <AppShell title="Settings" description="Manage your workspace and preferences">
      <div className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <SegmentedControl
            aria-label="Settings section"
            value={tab}
            onChange={setTab}
            options={tabs}
            size="md"
          />
        </div>

        <div className="max-w-3xl space-y-5">
          {tab === 'general' ? (
            <>
              <AppearanceSettings />
              <AccountSettings />
            </>
          ) : null}
          {tab === 'notifications' ? <NotificationSettings /> : null}
          {tab === 'locations' ? <LocationSettings /> : null}
          {tab === 'tariff' && isAdmin ? <TariffSettings /> : null}
          {tab === 'users' && isAdmin ? <UserSettings /> : null}
        </div>
      </div>
    </AppShell>
  );
}
