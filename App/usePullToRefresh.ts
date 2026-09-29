import { useState } from 'react';

// State for a ScrollView RefreshControl: shows the spinner until onRefresh finishes.
export default function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  return {
    refreshing,
    onRefresh: () => {
      setRefreshing(true);
      void onRefresh().finally(() => setRefreshing(false));
    },
  };
}
