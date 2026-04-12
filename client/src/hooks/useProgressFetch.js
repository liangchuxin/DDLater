import { useEffect, useState } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false });

export function useProgressFetch(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    NProgress.start();
    setLoading(true);
    fetch(url, options)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        NProgress.done();
      })
      .catch(() => {
        setLoading(false);
        NProgress.done();
      });
  }, [url]);

  return { data, loading };
}
