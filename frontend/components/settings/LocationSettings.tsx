'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { IconEdit, IconLocation, IconPlus, IconTrash } from '@/components/layout/Icons';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Location } from '@/lib/types';

export function LocationSettings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const locations = useSWR<{ locations: Location[] }>('/api/locations');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setName('');
    setAddress('');
    setError(null);
    setFormOpen(true);
  }

  function openEdit(location: Location) {
    setEditing(location);
    setName(location.name);
    setAddress(location.address ?? '');
    setError(null);
    setFormOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), address: address.trim() || null };

    try {
      if (editing) {
        await apiFetch(`/api/locations/${editing.id}`, { method: 'PATCH', body });
      } else {
        await apiFetch('/api/locations', { method: 'POST', body });
      }
      await locations.mutate();
      toast({
        title: editing ? 'Location updated' : 'Location added',
        tone: 'success',
        duration: 3000,
      });
      setFormOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save location');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/api/locations/${deleting.id}`, { method: 'DELETE' });
      await locations.mutate();
      toast({ title: 'Location removed', tone: 'success', duration: 3000 });
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete location');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Locations"
          description="Sites that group your metered devices"
          action={
            isAdmin ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<IconPlus className="h-4 w-4" />}
                onClick={openCreate}
              >
                Add location
              </Button>
            ) : null
          }
        />

        {locations.error ? (
          <ErrorState onRetry={() => locations.mutate()} compact />
        ) : !locations.data ? (
          <div className="divide-y divide-line">
            {[0, 1, 2].map((index) => (
              <div key={index} className="px-5 py-3.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-56" />
              </div>
            ))}
          </div>
        ) : locations.data.locations.length === 0 ? (
          <EmptyState
            icon={<IconLocation className="h-5 w-5" />}
            title="No locations yet"
            description="Add a site to start grouping devices by where they live."
            action={isAdmin ? { label: 'Add location', onClick: openCreate } : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {locations.data.locations.map((location) => (
              <li
                key={location.id}
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle/60 sm:px-5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-ink-muted">
                  <IconLocation className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{location.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {location.address || 'No address set'} · {location.deviceCount} device
                    {location.deviceCount === 1 ? '' : 's'}
                  </p>
                </div>

                {isAdmin ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${location.name}`}
                      onClick={() => openEdit(location)}
                    >
                      <IconEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${location.name}`}
                      onClick={() => {
                        setError(null);
                        setDeleting(location);
                      }}
                      className="hover:text-critical"
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---- Create / edit ---- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit location' : 'Add location'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
              {editing ? 'Save' : 'Add location'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Downtown HQ"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            label="Address"
            placeholder="Building A, 410 Market Street"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            hint="Optional — shown on the locations list."
          />
          {error ? (
            <div className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5">
              <p className="text-xs text-critical-fg">{error}</p>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* ---- Delete confirmation ---- */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={saving}>
              Delete location
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          {deleting && deleting.deviceCount > 0
            ? `This location still has ${deleting.deviceCount} device${deleting.deviceCount === 1 ? '' : 's'}. Move or delete them first — deleting a site would take its entire reading history with it.`
            : 'This location has no devices, so nothing else will be affected.'}
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
