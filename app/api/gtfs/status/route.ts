import { NextResponse } from 'next/server';
import { getStaticGtfs } from '../gtfsLookup';


export async function GET() {
  try {
    const gtfs = await getStaticGtfs();
    let stopTimeCount = 0;
    let shapePointCount = 0;

    for (const rows of gtfs.stopTimesByTrip.values()) stopTimeCount += rows.length;
    for (const rows of gtfs.shapesById.values()) shapePointCount += rows.length;

    return NextResponse.json({
      status: 'ok',
      counts: {
        routes: gtfs.routes.size,
        trips: gtfs.trips.size,
        stops: gtfs.stops.size,
        tripsWithStopTimes: gtfs.stopTimesByTrip.size,
        stopTimes: stopTimeCount,
        shapes: gtfs.shapesById.size,
        shapePoints: shapePointCount,
      },
    });
  } catch (error) {
    console.error('Static GTFS status check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Static GTFS load failed.',
      },
      { status: 500 }
    );
  }
}
