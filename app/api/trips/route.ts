import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchOctaBuffer } from '../../utils';

const TRIP_UPDATES_URL =
  'https://api.octa.net/GTFSRealTime/protoBuf/tripupdates.aspx';

export async function GET() {
  try {
    const buffer = await fetchOctaBuffer(TRIP_UPDATES_URL);

    // Guard against HTML error/block pages
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

    console.log(feed);

    const tripUpdates = feed.entity
      .filter(function (entity) {
        return Boolean(entity.tripUpdate && entity.tripUpdate.trip);
      })
      .map(function (entity) {
        const tu = entity.tripUpdate!;
        const stopTimeUpdates = (tu.stopTimeUpdate || []).map(function (stu) {
          return {
            stopSequence: stu.stopSequence ?? null,
            stopId: stu.stopId || '',
            arrivalDelaySec: stu.arrival?.delay ?? null,
            arrivalTime: stu.arrival?.time ? Number(stu.arrival.time) : null,
            departureDelaySec: stu.departure?.delay ?? null,
            departureTime: stu.departure?.time
              ? Number(stu.departure.time)
              : null,
            scheduleRelationship: stu.scheduleRelationship ?? null,
          };
        });

        return {
          id: entity.id,
          tripId: tu.trip?.tripId || '',
          routeId: tu.trip?.routeId || '',
          directionId:
            tu.trip?.directionId !== undefined && tu.trip?.directionId !== null
              ? String(tu.trip.directionId)
              : null,
          startTime: tu.trip?.startTime || '',
          startDate: tu.trip?.startDate || '',
          scheduleRelationship: tu.trip?.scheduleRelationship ?? null,
          vehicleId: tu.vehicle?.id || null,
          vehicleLabel: tu.vehicle?.label || null,
          timestamp: Number(tu.timestamp ?? feed.header?.timestamp ?? 0),
          delaySec: tu.delay ?? null,
          stopTimeUpdates,
        };
      });

    return NextResponse.json({
      count: tripUpdates.length,
      updatedAt: Date.now(),
      tripUpdates,
    });
  } catch (error) {
    console.error('GTFS TripUpdates fetch error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch or decode OCTA trip updates feed',
      },
      { status: 500 }
    );
  }
}
