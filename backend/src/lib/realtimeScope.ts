import { Request } from 'express';
import { RangeFilter } from '../services/analytics';
import { getRealtimeLocationId } from '../services/realtimeIngest';

export function wantsRealtimeScope(req: Request): boolean {
  return req.query.source === 'realtime' || req.query.scope === 'realtime';
}

export async function applyRealtimeScope<T extends RangeFilter>(
  req: Request,
  filter: T,
): Promise<T> {
  if (!wantsRealtimeScope(req)) return filter;

  const realtimeLocationId = await getRealtimeLocationId();
  const locationIds = filter.locationIds?.length
    ? filter.locationIds.includes(realtimeLocationId)
      ? [realtimeLocationId]
      : ['__no_realtime_location__']
    : [realtimeLocationId];

  return { ...filter, locationIds };
}
