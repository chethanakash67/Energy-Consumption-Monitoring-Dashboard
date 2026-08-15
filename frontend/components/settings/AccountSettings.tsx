'use client';

import { useState } from 'react';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';

export function AccountSettings() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) return null;

  async function saveName() {
    setSavingName(true);
    try {
      await apiFetch('/api/auth/me', { method: 'PATCH', body: { name: name.trim() } });
      updateUser({ name: name.trim() });
      toast({ title: 'Name updated', tone: 'success', duration: 3000 });
    } catch {
      toast({ title: "Couldn't update name", tone: 'critical' });
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        // The 401 here means "wrong current password", not "session expired" —
        // letting the interceptor redirect would log the user out mid-form.
        silent401: true,
      });
      setCurrentPassword('');
      setNewPassword('');
      toast({ title: 'Password changed', tone: 'success', duration: 3500 });
    } catch (caught) {
      setPasswordError(
        caught instanceof ApiError ? caught.message : 'Could not change password',
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Account"
          description={user.email}
          action={
            <Badge tone={user.role === 'ADMIN' ? 'brand' : 'neutral'}>
              {user.role === 'ADMIN' ? 'Administrator' : 'Viewer'}
            </Badge>
          }
        />
        <CardBody>
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Shown in the sidebar and against alerts you acknowledge."
          />
        </CardBody>
        <CardFooter className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={saveName}
            loading={savingName}
            disabled={name.trim() === user.name || name.trim().length < 2}
          >
            Save name
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader title="Password" description="Change the password for this account" />
        <CardBody className="space-y-4">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={passwordError ?? undefined}
            hint="At least 8 characters."
          />
        </CardBody>
        <CardFooter className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={changePassword}
            loading={savingPassword}
            disabled={!currentPassword || newPassword.length < 8}
          >
            Change password
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
