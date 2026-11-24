import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

export type GtfsRoute = {
  routeId: string;
  shortName: string;
  longName: string;
  routeType: number | null;
  routeColor: string | null;
  textColor: string | null;
};

export type GtfsTrip = {
  tripId: string;
  routeId: string;
  serviceId: string;
  directionId: string | null;
  headsign: string;
  shapeId: string;
};

export type GtfsStop = {
  stopId: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type GtfsStopTime = {
  tripId: string;
  arrivalTime: string;
  departureTime: string;
  stopId: string;
  stopSequence: number;
  shapeDistTraveled: number | null;
};

export type GtfsShapePoint = {
  latitude: number;
  longitude: number;
  sequence: number;
  distanceTraveled: number | null;
};

export type StaticGtfsData = {
  routes: Map<string, GtfsRoute>;
  trips: Map<string, GtfsTrip>;
  stops: Map<string, GtfsStop>;
  stopTimesByTrip: Map<string, GtfsStopTime[]>;
  shapesById: Map<string, GtfsShapePoint[]>;
};

let staticGtfsPromise: Promise<StaticGtfsData> | null = null;

/** Parse one GTFS CSV record. GTFS text files use one record per line. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  fields.push(value.trim());
  return fields;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredColumnIndex(headers: string[], column: string, file: string) {
  const index = headers.indexOf(column);
  if (index < 0) {
    throw new Error(`GTFS ${file} is missing required column "${column}".`);
  }
  return index;
}

/** Stream a GTFS text file so stop_times.txt/shapes.txt aren't read into memory twice. */
async function readGtfsCsv(
  fileName: string,
  onRow: (headers: string[], values: string[]) => void | Promise<void>
): Promise<void> {
  const filePath = path.join(process.cwd(), 'data', 'gtfs', fileName);
  const input = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: string[] | null = null;
  let rowNumber = 0;

  try {
    for await (const originalLine of lines) {
      rowNumber += 1;
      if (!originalLine.trim()) continue;

      const line = rowNumber === 1
        ? originalLine.replace(/^\uFEFF/, '')
        : originalLine;
      const values = parseCsvLine(line);

      if (!headers) {
        headers = values;
        continue;
      }

      await onRow(headers, values);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      throw new Error(
        `Missing data/gtfs/${fileName}. Download OCTA's current static GTFS ZIP and extract the required .txt files into data/gtfs/.`
      );
    }
    throw error;
  } finally {
    lines.close();
  }

  if (!headers) {
    throw new Error(`GTFS ${fileName} is empty or has no header row.`);
  }
}

async function loadStaticGtfs(): Promise<StaticGtfsData> {
  const routes = new Map<string, GtfsRoute>();
  const trips = new Map<string, GtfsTrip>();
  const stops = new Map<string, GtfsStop>();
  const stopTimesByTrip = new Map<string, GtfsStopTime[]>();
  const shapesById = new Map<string, GtfsShapePoint[]>();

  await readGtfsCsv('routes.txt', async (headers, row) => {
    const routeIdIndex = requiredColumnIndex(headers, 'route_id', 'routes.txt');
    const routeId = row[routeIdIndex] || '';
    if (!routeId) return;

    const get = (name: string) => {
      const index = headers.indexOf(name);
      return index >= 0 ? row[index] || '' : '';
    };

    routes.set(routeId, {
      routeId,
      shortName: get('route_short_name'),
      longName: get('route_long_name'),
      routeType: numberOrNull(get('route_type')),
      routeColor: get('route_color') || null,
      textColor: get('route_text_color') || null,
    });
  });

  await readGtfsCsv('trips.txt', async (headers, row) => {
    const tripIdIndex = requiredColumnIndex(headers, 'trip_id', 'trips.txt');
    const routeIdIndex = requiredColumnIndex(headers, 'route_id', 'trips.txt');
    const shapeIdIndex = requiredColumnIndex(headers, 'shape_id', 'trips.txt');
    const tripId = row[tripIdIndex] || '';
    if (!tripId) return;

    const get = (name: string) => {
      const index = headers.indexOf(name);
      return index >= 0 ? row[index] || '' : '';
    };

    trips.set(tripId, {
      tripId,
      routeId: row[routeIdIndex] || '',
      serviceId: get('service_id'),
      directionId: get('direction_id') || null,
      headsign: get('trip_headsign'),
      shapeId: row[shapeIdIndex] || '',
    });
  });

  await readGtfsCsv('stops.txt', async (headers, row) => {
    const stopIdIndex = requiredColumnIndex(headers, 'stop_id', 'stops.txt');
    const latIndex = requiredColumnIndex(headers, 'stop_lat', 'stops.txt');
    const lonIndex = requiredColumnIndex(headers, 'stop_lon', 'stops.txt');
    const stopId = row[stopIdIndex] || '';
    const latitude = numberOrNull(row[latIndex]);
    const longitude = numberOrNull(row[lonIndex]);
    if (!stopId || latitude === null || longitude === null) return;

    const get = (name: string) => {
      const index = headers.indexOf(name);
      return index >= 0 ? row[index] || '' : '';
    };

    stops.set(stopId, {
      stopId,
      code: get('stop_code'),
      name: get('stop_name'),
      latitude,
      longitude,
    });
  });

  await readGtfsCsv('stop_times.txt', async (headers, row) => {
    const tripIdIndex = requiredColumnIndex(headers, 'trip_id', 'stop_times.txt');
    const stopIdIndex = requiredColumnIndex(headers, 'stop_id', 'stop_times.txt');
    const sequenceIndex = requiredColumnIndex(headers, 'stop_sequence', 'stop_times.txt');
    const tripId = row[tripIdIndex] || '';
    const stopId = row[stopIdIndex] || '';
    const stopSequence = numberOrNull(row[sequenceIndex]);
    if (!tripId || !stopId || stopSequence === null) return;

    const get = (name: string) => {
      const index = headers.indexOf(name);
      return index >= 0 ? row[index] || '' : '';
    };

    const stopTime: GtfsStopTime = {
      tripId,
      arrivalTime: get('arrival_time'),
      departureTime: get('departure_time'),
      stopId,
      stopSequence,
      shapeDistTraveled: numberOrNull(get('shape_dist_traveled')),
    };

    const tripStops = stopTimesByTrip.get(tripId) || [];
    tripStops.push(stopTime);
    stopTimesByTrip.set(tripId, tripStops);
  });

  await readGtfsCsv('shapes.txt', async (headers, row) => {
    const shapeIdIndex = requiredColumnIndex(headers, 'shape_id', 'shapes.txt');
    const latIndex = requiredColumnIndex(headers, 'shape_pt_lat', 'shapes.txt');
    const lonIndex = requiredColumnIndex(headers, 'shape_pt_lon', 'shapes.txt');
    const sequenceIndex = requiredColumnIndex(headers, 'shape_pt_sequence', 'shapes.txt');
    const shapeId = row[shapeIdIndex] || '';
    const latitude = numberOrNull(row[latIndex]);
    const longitude = numberOrNull(row[lonIndex]);
    const sequence = numberOrNull(row[sequenceIndex]);
    if (!shapeId || latitude === null || longitude === null || sequence === null) return;

    const distanceIndex = headers.indexOf('shape_dist_traveled');
    const point: GtfsShapePoint = {
      latitude,
      longitude,
      sequence,
      distanceTraveled: distanceIndex >= 0
        ? numberOrNull(row[distanceIndex])
        : null,
    };

    const shape = shapesById.get(shapeId) || [];
    shape.push(point);
    shapesById.set(shapeId, shape);
  });

  for (const stopTimes of stopTimesByTrip.values()) {
    stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);
  }
  for (const shapePoints of shapesById.values()) {
    shapePoints.sort((a, b) => a.sequence - b.sequence);
  }

  if (routes.size === 0 || trips.size === 0 || stops.size === 0) {
    throw new Error('Static GTFS loaded, but one or more core tables are empty. Check that the files are from the same OCTA feed ZIP.');
  }

  return { routes, trips, stops, stopTimesByTrip, shapesById };
}

/** One cached load per warm serverless instance; failed loads can be retried. */
export function getStaticGtfs(): Promise<StaticGtfsData> {
  if (!staticGtfsPromise) {
    staticGtfsPromise = loadStaticGtfs().catch((error) => {
      staticGtfsPromise = null;
      throw error;
    });
  }
  return staticGtfsPromise;
}
