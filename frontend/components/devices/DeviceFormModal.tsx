'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { apiFetch, ApiError } from '@/lib/api';
import { DEVICE_TYPE_META, DEVICE_TYPES } from '@/lib/constants';
import { useToast } from '@/lib/toast';
import type { Device, DeviceStatus, DeviceType, Location } from '@/lib/types';

interface DeviceFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present when editing; absent when creating. */
  device?: Device | null;
  locations: Location[];
  onSaved: () => void;
}

const STATUS_OPTIONS: { value: DeviceStatus; label: string }[] = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'IDLE', label: 'Idle' },
  { value: 'OFFLINE', label: 'Offline' },
];

export function DeviceFormModal({
  open,
  onClose,
  device,
  locations,
  onSaved,
}: DeviceFormModalProps) {
  const { toast } = useToast();
  const editing = Boolean(device);

  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('HVAC');
  const [locationId, setLocationId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [threshold, setThreshold] = useState('');
  const [status, setStatus] = useState<DeviceStatus>('ONLINE');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Reset the form whenever the modal opens, so a previous edit never leaks
  // into a subsequent create.
  useEffect(() => {
    if (!open) return;
    setName(device?.name ?? '');
    setType(device?.type ?? 'HVAC');
    setLocationId(device?.locationId ?? locations[0]?.id ?? '');
    setCapacity(device ? String(device.ratedCapacityKw) : '');
    setThreshold(device?.thresholdKwh != null ? String(device.thresholdKwh) : '');
    setStatus(device?.status ?? 'ONLINE');
    setFieldErrors({});
    setFormError(null);
  }, [open, device, locations]);

  async function save() {
    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    const body = {
      name: name.trim(),
      type,
      locationId,
      ratedCapacityKw: Number(capacity),
      status,
      // Empty input means "no threshold", which the API models as null.
      thresholdKwh: threshold.trim() === '' ? null : Number(threshold),
    };

    try {
      if (editing) {
        await apiFetch(`/api/devices/${device!.id}`, { method: 'PATCH', body });
      } else {
        await apiFetch('/api/devices', { method: 'POST', body });
      }
      toast({
        title: editing ? 'Device updated' : 'Device added',
        description: `${body.name} has been saved.`,
        tone: 'success',
        duration: 3500,
      });
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors);
        setFormError(caught.message);
      } else {
        setFormError('Could not reach the API.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit device' : 'Add device'}
      description={
        editing
          ? 'Update this meter’s configuration and alert threshold.'
          : 'Register a new metered device. It starts producing readings on the next interval.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={saving}
            disabled={!name.trim() || !locationId || !capacity}
          >
            {editing ? 'Save changes' : 'Add device'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Device name"
          placeholder="Rooftop HVAC Unit"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Type"
            value={type}
            onChange={(event) => setType(event.target.value as DeviceType)}
            options={DEVICE_TYPES.map((value) => ({
              value,
              label: DEVICE_TYPE_META[value].label,
            }))}
            error={fieldErrors.type}
          />

          <Select
            label="Location"
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={locations.map((location) => ({
              value: location.id,
              label: location.name,
            }))}
            error={fieldErrors.locationId}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Rated capacity"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="45"
            suffix="kW"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            error={fieldErrors.ratedCapacityKw}
            hint="Nameplate power draw"
            required
          />

          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as DeviceStatus)}
            options={STATUS_OPTIONS}
          />
        </div>

        <Input
          label="Alert threshold"
          type="number"
          min="0"
          step="0.1"
          placeholder="Leave blank for none"
          suffix="kWh"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          error={fieldErrors.thresholdKwh}
          hint="Raise an alert when a single 15-minute interval exceeds this value."
        />

        {formError ? (
          <div className="rounded-md border border-critical/30 bg-critical-subtle px-3 py-2.5">
            <p className="text-xs text-critical-fg">{formError}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
