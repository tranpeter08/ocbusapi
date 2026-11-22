'use client';

import { Bus } from './types';

type BusTableProps = {
  buses: Bus[];
  sortBy: 'id' | 'route';
  sortOrder: 'asc' | 'desc';
  selectedBusId: string | null;
  onSort: (column: 'id' | 'route') => void;
  onSelectBus: (bus: Bus) => void;
};

export default function BusTable({
  buses,
  sortBy,
  sortOrder,
  selectedBusId,
  onSort,
  onSelectBus,
}: BusTableProps) {
  const renderCaret = (column: 'id' | 'route') => {
    if (sortBy !== column) {
      return <span className='text-xs text-gray-400'>⇅</span>;
    }
    return (
      <span className='text-xs text-blue-600'>
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  return (
    <div className='overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm'>
      <table className='w-full text-left border-collapse text-sm'>
        <thead>
          <tr className='border-b bg-gray-100 text-gray-700'>
            <th className='py-3 px-4 font-semibold'>
              <button
                type='button'
                onClick={() => onSort('id')}
                className='inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer select-none'
                title='Sort by Bus ID'
              >
                <span>Bus ID</span>
                {renderCaret('id')}
              </button>
            </th>
            <th className='py-3 px-4 font-semibold'>
              <button
                type='button'
                onClick={() => onSort('route')}
                className='inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer select-none'
                title='Sort by Route'
              >
                <span>Route</span>
                {renderCaret('route')}
              </button>
            </th>
            <th className='py-3 px-4 font-semibold'>Last Ping</th>
            <th className='py-3 px-4 font-semibold'>Map</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-200'>
          {buses.map((bus) => {
            const isNotInService = bus.routeId === '0';
            const isSelected = bus.id === selectedBusId;

            return (
              <tr
                key={bus.id}
                className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
              >
                <td className='py-2.5 px-4 font-mono font-medium'>{bus.id}</td>
                <td className='py-2.5 px-4'>
                  <span
                    className={`inline-block font-semibold px-2 py-0.5 rounded text-xs ${
                      isNotInService
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {isNotInService ? 'NIS' : `${bus.routeId}`}
                  </span>
                </td>
                <td className='py-2.5 px-4 text-gray-500'>
                  {bus.timestamp
                    ? new Date(bus.timestamp * 1000).toLocaleTimeString()
                    : '—'}
                </td>
                <td className='py-2.5 px-4'>
                  <button
                    type='button'
                    onClick={() => onSelectBus?.(bus)}
                    className='text-blue-600 hover:underline font-medium cursor-pointer'
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}

          {buses.length === 0 && (
            <tr>
              <td colSpan={4} className='py-8 text-center text-gray-500'>
                No active buses match your filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
