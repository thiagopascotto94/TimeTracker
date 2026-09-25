import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2 } from 'lucide-react';

export interface LinkMetadata {
  url: string;
  originalUrl: string;
  hostname: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

// Client-side in-memory cache to prevent redundant requests
const clientMetadataCache = new Map<string, LinkMetadata>();
const pendingRequests = new Map<string, Promise<LinkMetadata>>();

function cleanUrl(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('<') && cleaned.endsWith('>')) cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) cleaned = cleaned.slice(1, -1);
  // Strip trailing punctuation commonly appended in sentences
  cleaned = cleaned.replace(/[.,;:!?)]+$/, '');
  return cleaned;
}

export function extractAllUrls(notes?: string | null, link?: string | null): string[] {
  const urls: string[] = [];

  if (link && typeof link === 'string') {
    const cleaned = cleanUrl(link);
    if (cleaned) urls.push(cleaned);
  }

  if (notes && typeof notes === 'string') {
    const regex = /(https?:\/\/[^\s<>"'{}|\\^`[\]]+)/gi;
    const matches = notes.match(regex);
    if (matches) {
      for (const m of matches) {
        const cleaned = cleanUrl(m);
        if (cleaned) urls.push(cleaned);
      }
    }
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const href = parsed.href;
        if (!seen.has(href)) {
          seen.add(href);
          valid.push(href);
        }
      }
    } catch {
      // Ignore invalid URL strings
    }
  }

  return valid;
}

// Backwards compatibility helper
export function extractFirstUrl(text?: string | null): string | null {
  const all = extractAllUrls(text);
  return all.length > 0 ? all[0] : null;
}

async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  if (clientMetadataCache.has(url)) {
    return clientMetadataCache.get(url)!;
  }

  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/public/link-metadata?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data: LinkMetadata = await res.json();
        clientMetadataCache.set(url, data);
        return data;
      }
    } catch (e) {
      // Ignore network errors, will use fallback
    }

    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {}

    const fallback: LinkMetadata = {
      url,
      originalUrl: url,
      hostname,
      title: hostname,
      description: null,
      image: null,
      siteName: hostname,
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`,
    };
    clientMetadataCache.set(url, fallback);
    return fallback;
  })().finally(() => {
    pendingRequests.delete(url);
  });

  pendingRequests.set(url, promise);
  return promise;
}

interface SingleCardProps {
  url: string;
}

function SingleTaskLinkCard({ url }: SingleCardProps) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(() => clientMetadataCache.get(url) || null);
  const [loading, setLoading] = useState<boolean>(() => !clientMetadataCache.has(url));
  const [imgError, setImgError] = useState(false);
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!clientMetadataCache.has(url)) {
      setLoading(true);
      fetchLinkMetadata(url).then((data) => {
        if (isMounted) {
          setMetadata(data);
          setLoading(false);
        }
      });
    } else {
      setMetadata(clientMetadataCache.get(url)!);
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [url]);

  let hostname = '';
  let displayPath = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    displayPath = parsed.pathname !== '/' ? parsed.pathname : '';
  } catch {
    hostname = url;
  }

  const title = metadata?.title || hostname;
  const description = metadata?.description;
  const siteName = metadata?.siteName || hostname;
  const image = !imgError && metadata?.image ? metadata.image : null;
  const favicon = !iconError && metadata?.favicon ? metadata.favicon : `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group relative flex items-start gap-3 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 hover:bg-neutral-50/80 dark:hover:bg-neutral-800 transition-all shadow-2xs hover:shadow-xs text-left max-w-full overflow-hidden"
      title={`Abrir link: ${url}`}
    >
      {/* Favicon or Globe */}
      <div className="w-5 h-5 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60 overflow-hidden mt-0.5">
        {loading ? (
          <Loader2 className="w-3 h-3 text-neutral-400 animate-spin" />
        ) : favicon ? (
          <img
            src={favicon}
            alt=""
            className="w-3.5 h-3.5 object-contain"
            onError={() => setIconError(true)}
          />
        ) : (
          <Globe className="w-3 h-3 text-neutral-500" />
        )}
      </div>

      {/* Text Info */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 text-3xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          <span className="truncate max-w-[180px]">{siteName}</span>
          {displayPath && (
            <>
              <span>•</span>
              <span className="truncate max-w-[140px] lowercase">{displayPath}</span>
            </>
          )}
        </div>

        {loading ? (
          <div className="space-y-1 py-0.5">
            <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-750 rounded animate-pulse" />
            <div className="h-2.5 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-2xs font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {title}
            </div>
            {description && (
              <p className="text-3xs text-neutral-600 dark:text-neutral-300 line-clamp-1 leading-normal">
                {description}
              </p>
            )}
          </>
        )}
      </div>

      {/* Image Thumbnail (if available) */}
      {image && !loading && (
        <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200/80 dark:border-neutral-750">
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        </div>
      )}

      {/* External Icon */}
      <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-colors mt-0.5" />
    </a>
  );
}

interface TaskLinkCardProps {
  notes?: string | null;
  link?: string | null;
}

export function TaskLinkCard({ notes, link }: TaskLinkCardProps) {
  const urls = extractAllUrls(notes, link);

  if (urls.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-1.5 w-full max-w-full">
      {urls.map((url) => (
        <SingleTaskLinkCard key={url} url={url} />
      ))}
    </div>
  );
}
