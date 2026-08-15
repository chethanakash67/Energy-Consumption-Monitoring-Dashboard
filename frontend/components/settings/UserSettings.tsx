'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { IconPlus, IconTrash, IconUsers } from '@/components/layout/Icons';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { Role } from '@/lib/types';

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export function UserSettings() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const users = useSWR<{ users: ManagedUser[] }>('/api/users');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');

  async function createUser() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password, role },
      });
      await users.mutate();
      toast({ title: 'User created', description: email, tone: 'success', duration: 3500 });
      setInviteOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('VIEWER');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create user');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(target: ManagedUser, nextRole: Role) {
    try {
      await apiFetch(`/api/users/${target.id}`, { method: 'PATCH', body: { role: nextRole } });
      await users.mutate();
      toast({
        title: `${target.name} is now ${nextRole === 'ADMIN' ? 'an admin' : 'a viewer'}`,
        tone: 'success',
        duration: 3000,
      });
    } catch (caught) {
      toast({
        title: "Couldn't change role",
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: 'critical',
      });
    }
  }

  async function removeUser() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/users/${deleting.id}`, { method: 'DELETE' });
      await users.mutate();
      toast({ title: 'User removed', tone: 'success', duration: 3000 });
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Users"
          description="Admins can manage devices, locations, and tariffs. Viewers have read-only access."
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={<IconPlus className="h-4 w-4" />}
              onClick={() => {
                setError(null);
                setInviteOpen(true);
              }}
            >
              Add user
            </Button>
          }
        />

        {users.error ? (
          <ErrorState onRetry={() => users.mutate()} compact />
        ) : !users.data ? (
          <div className="divide-y divide-line">
            {[0, 1].map((index) => (
              <div key={index} className="px-5 py-3.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {users.data.users.map((managed) => {
              const isSelf = managed.id === currentUser?.id;

              return (
                <li
                  key={managed.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle/60 sm:px-5"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white shadow-glow-brand-sm"
                    style={{
                      background: 'linear-gradient(140deg, var(--series-1), var(--series-5))',
                    }}
                  >
                    {managed.name
                      .split(' ')
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join('')}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      {managed.name}
                      {isSelf ? <Badge tone="brand">You</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {managed.email} · joined {formatDate(managed.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      aria-label={`Role for ${managed.name}`}
                      value={managed.role}
                      onChange={(event) => changeRole(managed, event.target.value as Role)}
                      options={[
                        { value: 'ADMIN', label: 'Admin' },
                        { value: 'VIEWER', label: 'Viewer' },
                      ]}
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${managed.name}`}
                      disabled={isSelf}
                      title={isSelf ? 'You cannot remove your own account' : undefined}
                      onClick={() => {
                        setError(null);
                        setDeleting(managed);
                      }}
                      className="hover:text-critical"
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add a user"
        description="Create an account directly. There is no email delivery in this demo, so set the initial password here and share it out of band."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={createUser}
              loading={busy}
              disabled={!name.trim() || !email.trim() || password.length < 8}
            >
              Create user
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jordan Lee"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jordan@company.com"
            required
          />
          <Input
            label="Initial password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            hint="The user can change this later from their own settings."
            required
          />
          <Select
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            options={[
              { value: 'VIEWER', label: 'Viewer — read-only' },
              { value: 'ADMIN', label: 'Admin — full access' },
            ]}
          />
          {error ? (
            <div className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5">
              <p className="text-xs text-critical-fg">{error}</p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={removeUser} loading={busy}>
              Remove user
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          They will lose access immediately. Alerts they previously acknowledged stay in the log,
          but will no longer show their name.
        </p>
        {error ? (
          <div className="mt-3 rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5">
            <p className="text-xs text-critical-fg">{error}</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
