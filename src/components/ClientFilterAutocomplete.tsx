import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Briefcase, Check, ChevronDown } from 'lucide-react';
import { Client } from '../types';

interface ClientFilterAutocompleteProps {
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  allLabel?: string;
  allValue?: string;
}

export function ClientFilterAutocomplete({
  clients,
  selectedClientId,
  onSelectClient,
  allLabel = 'Todos os Clientes',
  allValue = 'all',
}: ClientFilterAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAll = selectedClientId === allValue || selectedClientId === '';
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative inline-block text-left w-56 sm:w-64" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 cursor-pointer shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="truncate font-medium">
            {isAll ? allLabel : selectedClient ? selectedClient.name : allLabel}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-full min-w-[240px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar cliente..."
                className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 pl-8 pr-7 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            <div
              onClick={() => {
                onSelectClient(allValue);
                setIsOpen(false);
                setQuery('');
              }}
              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                isAll
                  ? 'bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
              }`}
            >
              <span>{allLabel}</span>
              {isAll && <Check className="w-3.5 h-3.5" />}
            </div>

            {filteredClients.length === 0 ? (
              <div className="px-3 py-3 text-xs text-center text-neutral-400">
                Nenhum cliente encontrado
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = c.id === selectedClientId;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectClient(c.id);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      {c.company && (
                        <div className="text-2xs text-neutral-400 truncate">{c.company}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
