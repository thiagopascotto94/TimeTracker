import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GitBranch,
  Search,
  Check,
  Loader2,
  ChevronDown,
  X,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

export interface GitBranchItem {
  name: string;
  commitSha?: string;
  isDefault?: boolean;
  isProtected?: boolean;
}

interface GitBranchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  repo: string;
  provider?: 'github' | 'gitlab';
  token?: string;
  gitlabUrl?: string;
  clientId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GitBranchAutocomplete({
  value,
  onChange,
  repo,
  provider = 'github',
  token,
  gitlabUrl,
  clientId,
  placeholder = 'main ou selecione uma branch...',
  disabled = false,
  className = '',
}: GitBranchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<GitBranchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keep search input in sync with external value initially or when value changes
  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

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

  // Fetch branches with debounced query
  const fetchBranches = useCallback(
    async (search = '') => {
      const cleanRepo = repo.trim();
      if (!cleanRepo) {
        setBranches([]);
        setError('Informe o repositório acima para listar as branches.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const payload: Record<string, any> = {
          provider,
          repo: cleanRepo,
          token: token?.trim() || undefined,
          search: search.trim() || undefined,
          client_id: clientId || undefined,
        };

        if (provider === 'gitlab') {
          payload.project = cleanRepo;
          if (gitlabUrl) payload.gitlabUrl = gitlabUrl.trim();
        }

        const res = await apiFetch('/api/git/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro ao carregar branches (HTTP ${res.status})`);
        }

        const data = await res.json();

        if (Array.isArray(data.branches)) {
          setBranches(data.branches);
        } else {
          setBranches([]);
        }
      } catch (err: any) {
        console.warn('Could not fetch git branches:', err);
        setError(err.message || 'Não foi possível carregar as branches do repositório.');
        setBranches([]);
      } finally {
        setLoading(false);
      }
    },
    [repo, provider, token, gitlabUrl, clientId]
  );

  // Trigger search whenever debouncedSearch changes and dropdown is open
  useEffect(() => {
    if (isOpen && repo.trim()) {
      fetchBranches(debouncedSearch);
    }
  }, [debouncedSearch, isOpen, repo, fetchBranches]);

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    fetchBranches(debouncedSearch);
  };

  const handleSelectBranch = (branchName: string) => {
    onChange(branchName);
    setSearchQuery(branchName);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onChange(val);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <div className="absolute left-2.5 pointer-events-none text-neutral-400 dark:text-neutral-500">
          <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleOpenDropdown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-8 pl-8 pr-14 text-xs font-mono rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {loading && (
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin mr-0.5" />
          )}

          {searchQuery && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded cursor-pointer transition-colors"
              title="Limpar branch"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                handleOpenDropdown();
                inputRef.current?.focus();
              }
            }}
            disabled={disabled}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded cursor-pointer transition-colors"
            title="Listar branches"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in-50 zoom-in-95 duration-100 font-sans">
          {/* Header info / status */}
          <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-850/60 flex flex-col gap-0.5 text-3xs text-neutral-500">
            <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
              <Search className="w-2.5 h-2.5" />
              <span>Branches</span>
            </span>
            {branches.length > 0 && <span>{branches.length} encontrada(s)</span>}
          </div>

          {!repo.trim() ? (
            <div className="p-3 text-center text-xs text-neutral-500 space-y-1">
              <AlertCircle className="w-4 h-4 text-amber-500 mx-auto" />
              <p className="text-2xs">Preencha o campo do repositório para carregar as branches disponíveis.</p>
            </div>
          ) : error ? (
            <div className="p-3 text-center text-xs text-rose-500 space-y-1">
              <AlertCircle className="w-4 h-4 text-rose-500 mx-auto" />
              <p className="text-2xs">{error}</p>
            </div>
          ) : loading && branches.length === 0 ? (
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Buscando branches...</span>
            </div>
          ) : branches.length === 0 ? (
            <div className="p-3 text-center text-xs text-neutral-400 space-y-1.5">
              <p>Nenhuma branch encontrada com "{debouncedSearch}".</p>
              {debouncedSearch && (
                <button
                  type="button"
                  onClick={() => handleSelectBranch(debouncedSearch)}
                  className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
                >
                  Usar "{debouncedSearch}" como SHA ou branch customizada
                </button>
              )}
            </div>
          ) : (
            branches.map((b) => {
              const isSelected = value.toLowerCase() === b.name.toLowerCase();
              return (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => handleSelectBranch(b.name)}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 font-mono">
                    <GitBranch className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{b.name}</span>

                    {b.isDefault && (
                      <span className="px-1.5 py-0.2 rounded text-3xs font-sans font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        padrão
                      </span>
                    )}

                    {b.isProtected && (
                      <span
                        title="Branch protegida"
                        className="text-neutral-400 hover:text-amber-500"
                      >
                        <Shield className="w-3 h-3 text-amber-500" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.commitSha && (
                      <span className="text-3xs font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        #{b.commitSha}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
