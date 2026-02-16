interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
}

export function Table<T extends { id?: string }>({ 
  columns, 
  data, 
  loading, 
  emptyMessage = 'No data found',
  onRowClick,
  striped = false
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500">Loading data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-slate-700 font-medium">{emptyMessage}</p>
        <p className="text-sm text-slate-500 mt-1">No records to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  px-4 py-3 
                  text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider
                  first:pl-5 last:pr-5
                  ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                  ${col.className || ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, index) => (
            <tr
              key={item.id || index}
              onClick={() => onRowClick?.(item)}
              className={`
                transition-colors duration-150
                ${onRowClick ? 'cursor-pointer hover:bg-emerald-50/60' : 'hover:bg-slate-50/60'}
                ${striped && index % 2 === 1 ? 'bg-slate-50/40' : ''}
              `}
            >
              {columns.map((col) => (
                <td 
                  key={col.key} 
                  className={`
                    px-4 py-3 text-sm text-slate-700
                    first:pl-5 last:pr-5
                    ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                    ${col.className || ''}
                  `}
                >
                  {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50/30">
      <div className="text-sm text-slate-500 order-2 sm:order-1">
        {totalItems ? (
          <span>Showing <span className="font-medium text-slate-700">{(currentPage - 1) * 10 + 1}</span> to <span className="font-medium text-slate-700">{Math.min(currentPage * 10, totalItems)}</span> of <span className="font-medium text-slate-700">{totalItems}</span> results</span>
        ) : (
          <span>Page <span className="font-medium text-slate-700">{currentPage}</span> of <span className="font-medium text-slate-700">{totalPages}</span></span>
        )}
      </div>
      <div className="flex gap-2 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200"
        >
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">←</span>
        </button>
        
        {/* Page numbers for larger screens */}
        <div className="hidden sm:flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                  currentPage === pageNum
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200"
        >
          <span className="hidden sm:inline">Next</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>
    </div>
  );
}
