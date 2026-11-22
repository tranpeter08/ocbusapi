import fs from 'node:fs/promises';
import path from 'node:path';

export type TripMeta = {
  routeId: string;
  directionId: string | null; // e.g. '0' or '1'
  headsign: string;
  shapeId: string;
};

let cachedTripsMap: Map<string, TripMeta> | null = null;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export async function getTripsMap(): Promise<Map<string, TripMeta>> {
  if (cachedTripsMap) {
    return cachedTripsMap;
  }

  // Place OCTA's static GTFS trips.txt at <project-root>/data/gtfs/trips.txt
  const filePath = path.join(process.cwd(), 'data', 'gtfs', 'trips.txt');

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      console.warn(
        `GTFS trips.txt not found at ${filePath}. Returning empty trips map.`
      );
      cachedTripsMap = new Map();
      return cachedTripsMap;
    }
    throw err;
  }

  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    cachedTripsMap = new Map();
    return cachedTripsMap;
  }

  const headers = parseCsvLine(lines[0]);
  const idx = (name: string) => headers.indexOf(name);

  const tripIdCol = idx('trip_id');
  const routeIdCol = idx('route_id');
  const directionIdCol = idx('direction_id');
  const headsignCol = idx('trip_headsign');
  const shapeIdCol = idx('shape_id');

  const map = new Map<string, TripMeta>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const tripId = tripIdCol >= 0 ? cols[tripIdCol] : '';
    if (!tripId) continue;

    map.set(tripId, {
      routeId: routeIdCol >= 0 ? cols[routeIdCol] : '',
      directionId:
        directionIdCol >= 0 && cols[directionIdCol] !== ''
          ? cols[directionIdCol]
          : null,
      headsign: headsignCol >= 0 ? cols[headsignCol] : '',
      shapeId: shapeIdCol >= 0 ? cols[shapeIdCol] : '',
    });
  }

  cachedTripsMap = map;
  return map;
}
