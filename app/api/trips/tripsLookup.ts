import { getStaticGtfs } from '../gtfs/gtfsLookup';

export type TripMeta = {
  routeId: string;
  directionId: string | null;
  headsign: string;
  shapeId: string;
};

/** Backwards-compatible adapter for the existing realtime trip lookup code. */
export async function getTripsMap(): Promise<Map<string, TripMeta>> {
  const gtfs = await getStaticGtfs();
  const result = new Map<string, TripMeta>();

  for (const [tripId, trip] of gtfs.trips) {
    result.set(tripId, {
      routeId: trip.routeId,
      directionId: trip.directionId,
      headsign: trip.headsign,
      shapeId: trip.shapeId,
    });
  }

  return result;
}
