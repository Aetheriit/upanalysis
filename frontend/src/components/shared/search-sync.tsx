"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function SearchSync({ onSearch }: { onSearch: (s: string) => void }) {
  const searchParams = useSearchParams();
  const search = searchParams?.get('search');
  
  useEffect(() => {
    if (search) {
      onSearch(search);
    }
  }, [search, onSearch]);

  return null;
}
