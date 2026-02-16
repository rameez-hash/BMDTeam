'use client';

import { useState, useCallback } from 'react';

interface UseApiOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
}

export function useApi<T = unknown>(options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (
    url: string,
    fetchOptions: RequestInit = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      };

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Request failed');
      }

      setData(responseData);
      options.onSuccess?.(responseData);
      return responseData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      options.onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const get = useCallback((url: string) => request(url), [request]);

  const post = useCallback((url: string, body: unknown) => 
    request(url, { method: 'POST', body: JSON.stringify(body) }), [request]);

  const put = useCallback((url: string, body: unknown) => 
    request(url, { method: 'PUT', body: JSON.stringify(body) }), [request]);

  const del = useCallback((url: string) => 
    request(url, { method: 'DELETE' }), [request]);

  return { data, loading, error, get, post, put, del, request };
}
