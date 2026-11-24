import { NextRequest, NextResponse } from 'next/server';
import { getStaticGtfs } from '../gtfsLookup';


export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get('tripId')?.trim();

  if (!tripId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: tripId' },
      { status: 400 }
    );
  }

  try {
    const gtfs = await getStaticGtfs();
    const trip = gtfs.trips.get(tripId);

    if (!trip) {
      return NextResponse.json(
        { error: `Trip ${tripId} was not found in the current static GTFS feed.` },
        { status: 404 }
      );
    }

    const route = gtfs.routes.get(trip.routeId) || null;
    const stopTimes = gtfs.stopTimesByTrip.get(tripId) || [];
    const shapePoints = trip.shapeId
      ? gtfs.shapesById.get(trip.shapeId) || []
      : [];

    const stops = stopTimes.map((stopTime) => {
      const stop = gtfs.stops.get(stopTime.stopId);
      return {
        stopId: stopTime.stopId,
        stopSequence: stopTime.stopSequence,
        arrivalTime: stopTime.arrivalTime || null,
        departureTime: stopTime.departureTime || null,
        shapeDistTraveled: stopTime.shapeDistTraveled,
        name: stop?.name || 'Unknown stop',
        code: stop?.code || null,
        latitude: stop?.latitude ?? null,
        longitude: stop?.longitude ?? null,
      };
    });

    return NextResponse.json(
      {
        trip,
        route,
        shape: shapePoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          sequence: point.sequence,
          distanceTraveled: point.distanceTraveled,
        })),
        stops,
        counts: {
          shapePoints: shapePoints.length,
          stops: stops.length,
        },
      },
      {
        headers: {
          // This response is schedule data, not live vehicle data.
          'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Static GTFS lookup failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Static GTFS lookup failed.',
      },
      { status: 500 }
    );
  }
}
