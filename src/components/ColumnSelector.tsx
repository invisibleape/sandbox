import React from 'react';
import { Settings } from 'lucide-react';

export interface Column {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnSelectorProps {
  columns: Column[];
  onChange: (columns: Column[]) => void;
}

export function ColumnSelector({ columns, onChange }: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleToggle = (columnId: string) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onChange(updatedColumns);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        title="Configure columns"
      >
        <Settings className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 py-1">
            <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b">
              Configure Columns
            </div>
            {columns.map(column => (
              <label
                key={column.id}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleToggle(column.id)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2">{column.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}