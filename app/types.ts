export type Bus = {
  id: string;
  routeId: string;
  tripId?: string;
  latitude: number;
  longitude: number;
  bearing?: number | null;
  speedMph?: number;
  timestamp: number;
  nextStopId?: string | null;
  nextStopName?: string | null;
  nextStopEta?: number | null;
  delaySec?: number | null;
};
