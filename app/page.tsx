'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import BusMap from './BusMap';
import BusTable from './BusTable';
import { Bus } from './types';

export default function AllBusesPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [filter, setFilter] = useState('');
  const [hideNis, setHideNis] = useState(false);
  const [sortBy, setSortBy] = useState<'id' | 'route'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  const refreshBuses = useCallback(async () => {
    try {
      const res = await fetch('/api/buses');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load buses');
      }

      setBuses(data.vehicles);
      setLastUpdated(new Date(data.updatedAt).toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      try {
        const res = await fetch('/api/buses');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load buses');
        }

        if (!ignore) {
          setBuses(data.vehicles);
          setLastUpdated(new Date(data.updatedAt).toLocaleTimeString());
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Error loading feed');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    initialFetch();
    const interval = setInterval(refreshBuses, 15000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [refreshBuses]);

  const handleSort = (column: 'id' | 'route') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleSelectBus = (bus: Bus) => {
    setSelectedBusId(bus.id);
    setFocusTrigger((prev) => prev + 1);
    mapSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  };

  const sortedAndFilteredBuses = buses
    .filter((b) => {
      if (hideNis && b.routeId === '0') {
        return false;
      }

      const query = filter.toLowerCase();
      const displayRoute = b.routeId === '0' ? 'nis' : b.routeId.toLowerCase();
      return (
        b.id.toLowerCase().includes(query) ||
        b.routeId.toLowerCase().includes(query) ||
        displayRoute.includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'route') {
        const routeA = a.routeId === '0' ? 'NIS' : a.routeId;
        const routeB = b.routeId === '0' ? 'NIS' : b.routeId;
        comparison = routeA.localeCompare(routeB, undefined, { numeric: true });
      }

      // Primary sort for "id", and secondary tie-breaker when routes match
      if (comparison === 0) {
        comparison = a.id.localeCompare(b.id, undefined, { numeric: true });
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const selectedBus = buses.find((b) => b.id === selectedBusId) || null;

  return (
    <main className='min-h-screen bg-gray-50 text-gray-900 p-6'>
      <div className='max-w-5xl mx-auto space-y-6'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold'>OC Bus Live Fleet Positions</h1>
            <p className='text-sm text-gray-600'>
              Showing {sortedAndFilteredBuses.length} of {buses.length} active
              buses
              {lastUpdated && ` • Updated at ${lastUpdated}`}
            </p>
          </div>
        </div>

        {/* Error / Loading States */}
        {error && (
          <div className='bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-sm'>
            {error}
          </div>
        )}

        {loading ? (
          <p className='text-gray-500 text-sm'>Fetching live OCTA feed...</p>
        ) : (
          <div className='space-y-6'>
            <div ref={mapSectionRef}>
              <BusMap
                buses={sortedAndFilteredBuses}
                selectedBus={selectedBus}
                focusTrigger={focusTrigger}
              />
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <input
                type='text'
                placeholder='Filter by Bus ID or Route...'
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className='border border-gray-300 bg-white rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500'
              />

              <button
                onClick={refreshBuses}
                className='bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md'
              >
                Refresh
              </button>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <label className='inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none'>
                <input
                  type='checkbox'
                  checked={hideNis}
                  onChange={(e) => setHideNis(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
                />
                <span>Hide &quot;Not In Service&quot; Buses</span>
              </label>
            </div>
            <BusTable
              buses={sortedAndFilteredBuses}
              sortBy={sortBy}
              sortOrder={sortOrder}
              selectedBusId={selectedBusId}
              onSort={handleSort}
              onSelectBus={handleSelectBus}
            />
          </div>
        )}
      </div>
    </main>
  );
}
