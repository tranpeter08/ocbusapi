import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchOctaBuffer } from '../../utils';

const OCTA_FEED_URL =
  'https://api.octa.net/GTFSRealTime/protoBuf/VehiclePositions.aspx';

export async function GET() {
  try {
    const buffer = await fetchOctaBuffer(OCTA_FEED_URL);

    // Check if first non-whitespace byte is ASCII 60 (HTML tag start)
    const preview = buffer.subarray(0, 200).toString('utf8').trimStart();
    if (preview.charCodeAt(0) === 60) {
      console.error('OCTA returned HTML instead of protobuf:\n', preview);
      return NextResponse.json(
        { error: 'OCTA returned HTML instead of protobuf', preview },
        { status: 502 }
      );
    }

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    const vehicles = feed.entity
      .filter(function (entity) {
        return Boolean(entity.vehicle && entity.vehicle.position);
      })
      .map(function (entity) {
        const v = entity.vehicle!;
        return {
          id: v.vehicle?.id || entity.id,
          routeId: v.trip?.routeId || 'Unassigned',
          tripId: v.trip?.tripId || '',
          latitude: v.position!.latitude,
          longitude: v.position!.longitude,
          bearing: v.position?.bearing ?? null,
          speedMph: v.position?.speed
            ? Math.round(v.position.speed * 2.23694)
            : 0,
          timestamp: Number(v.timestamp ?? 0),
        };
      })
      .sort(function (a, b) {
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });

    return NextResponse.json({
      count: vehicles.length,
      updatedAt: Date.now(),
      vehicles,
    });
  } catch (error) {
    console.error('GTFS fetch error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch or decode OCTA bus feed',
      },
      { status: 500 }
    );
  }
}
