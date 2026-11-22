import { fetchOctaBuffer } from '../../utils';
import { NextResponse } from 'next/server';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const SERVICE_ALERTS_URL =
  'https://api.octa.net/GTFSRealTime/protoBuf/servicealerts.aspx';

function getFirstTranslatedString(
  translatedString?: GtfsRealtimeBindings.transit_realtime.ITranslatedString | null
): string {
  const translations = translatedString?.translation;
  if (!translations || translations.length === 0) {
    return '';
  }

  const enMatch = translations.find(
    (t) => !t.language || t.language.toLowerCase().startsWith('en')
  );
  return (enMatch?.text || translations[0]?.text || '').trim();
}

export async function GET() {
  try {
    const buffer = await fetchOctaBuffer(SERVICE_ALERTS_URL);

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

    const alerts = feed.entity
      .filter(function (entity) {
        return Boolean(entity.alert);
      })
      .map(function (entity) {
        const alert = entity.alert!;

        const activePeriods = (alert.activePeriod || []).map((period) => ({
          start: period.start ? Number(period.start) : null,
          end: period.end ? Number(period.end) : null,
        }));

        const informedEntities = (alert.informedEntity || []).map((ie) => ({
          agencyId: ie.agencyId || null,
          routeId: ie.routeId || null,
          routeType: ie.routeType ?? null,
          directionId:
            ie.directionId !== undefined && ie.directionId !== null
              ? String(ie.directionId)
              : null,
          tripId: ie.trip?.tripId || null,
          stopId: ie.stopId || null,
        }));

        const routeIds = Array.from(
          new Set(
            informedEntities
              .map((ie) => ie.routeId)
              .filter((r): r is string => Boolean(r))
          )
        );

        const stopIds = Array.from(
          new Set(
            informedEntities
              .map((ie) => ie.stopId)
              .filter((s): s is string => Boolean(s))
          )
        );

        return {
          id: entity.id,
          headerText: getFirstTranslatedString(alert.headerText),
          descriptionText: getFirstTranslatedString(alert.descriptionText),
          url: getFirstTranslatedString(alert.url),
          cause: alert.cause ?? null,
          effect: alert.effect ?? null,
          severityLevel:
            (alert as { severityLevel?: number | null }).severityLevel ?? null,
          activePeriods,
          routeIds,
          stopIds,
          informedEntities,
        };
      });

    return NextResponse.json({
      count: alerts.length,
      updatedAt: Date.now(),
      alerts,
    });
  } catch (error) {
    console.error('GTFS ServiceAlerts fetch error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch or decode OCTA service alerts feed',
      },
      { status: 500 }
    );
  }
}
