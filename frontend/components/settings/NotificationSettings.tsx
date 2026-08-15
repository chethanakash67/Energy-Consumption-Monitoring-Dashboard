'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select, Switch } from '@/components/ui/Field';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { SEVERITY_META } from '@/lib/constants';
import type { Severity } from '@/lib/types';

export function NotificationSettings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  /**
   * Optimistic: the control moves immediately and rolls back if the request
   * fails, because a toggle that lags behind the click feels broken.
   */
  async function patch(changes: Partial<{ notifyInApp: boolean; notifyEmail: boolean; notifyMinLevel: Severity }>) {
    if (!user) return;
    const previous = {
      notifyInApp: user.notifyInApp,
      notifyEmail: user.notifyEmail,
      notifyMinLevel: user.notifyMinLevel,
    };

    updateUser(changes);
    setSaving(true);

    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: changes });
    } catch {
      updateUser(previous);
      toast({ title: "Couldn't save preferences", tone: 'critical' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description={saving ? 'Saving…' : 'Choose which alerts reach you and how'}
      />
      <CardBody className="space-y-5">
        <Switch
          checked={user.notifyInApp}
          onChange={(checked) => patch({ notifyInApp: checked })}
          label="In-app toasts"
          description="Show a notification in the corner of the screen when a new alert fires while you're using Voltiq."
        />

        <div className="border-t border-line pt-5">
          <Switch
            checked={user.notifyEmail}
            onChange={(checked) => patch({ notifyEmail: checked })}
            label="Email digests"
            description="Receive a summary of new alerts by email. No mail server is configured in this demo, so this preference is stored but not acted on."
          />
        </div>

        <div className="border-t border-line pt-5">
          <Select
            label="Minimum severity"
            value={user.notifyMinLevel}
            onChange={(event) => patch({ notifyMinLevel: event.target.value as Severity })}
            options={(Object.keys(SEVERITY_META) as Severity[]).map((value) => ({
              value,
              label: `${SEVERITY_META[value].label} and above`,
            }))}
            hint="Alerts below this level are still recorded in the log — they just won't interrupt you."
          />
        </div>
      </CardBody>
    </Card>
  );
}
