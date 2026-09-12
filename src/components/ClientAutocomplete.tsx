import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Briefcase, Check } from 'lucide-react';
import { Client } from '../types';
import { formatCurrency } from '../utils/format';

interface ClientAutocompleteProps {
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  defaultHourlyRate: number;
}

export function ClientAutocomplete({
  clients,
  selectedClientId,
  onSelectClient,
  defaultHourlyRate,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Debounce query (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

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

  // Filter clients based on debounced query
  const filteredClients = clients.filter((c) => {
    const q = debouncedQuery.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(q);
    const companyMatch = c.company?.toLowerCase().includes(q) || false;
    const emailMatch = c.email?.toLowerCase().includes(q) || false;
    return nameMatch || companyMatch || emailMatch;
  });

  return (
    <div className="relative" ref={containerRef}>
      {selectedClient ? (
        <div className="flex items-center justify-between rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                {selectedClient.name}
              </span>
              <span className="text-2xs text-neutral-500 dark:text-neutral-400 block truncate">
                {selectedClient.company ? `${selectedClient.company} • ` : ''}
                Taxa: {formatCurrency(selectedClient.hourly_rate ?? defaultHourlyRate)}/h
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectClient('');
              setQuery('');
            }}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded cursor-pointer shrink-0"
            title="Remover cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Pesquisar cliente ou projeto por nome/empresa..."
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-9 pr-9 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-200"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {isOpen && !selectedClient && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in-50 zoom-in-95 duration-100">
          <div
            onClick={() => {
              onSelectClient('');
              setIsOpen(false);
              setQuery('');
            }}
            className="px-3.5 py-2.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer flex items-center justify-between"
          >
            <span>Nenhum cliente específico (Taxa padrão)</span>
            {!selectedClientId && <Check className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />}
          </div>

          {filteredClients.length === 0 ? (
            <div className="px-3.5 py-4 text-xs text-center text-neutral-400 dark:text-neutral-500">
              Nenhum cliente encontrado para "{query}"
            </div>
          ) : (
            filteredClients.map((c) => {
              const isSelected = c.id === selectedClientId;
              const rate = c.hourly_rate ?? defaultHourlyRate;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectClient(c.id);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      {c.company && (
                        <div className="text-2xs text-neutral-400 truncate">{c.company}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(rate)}/h
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
