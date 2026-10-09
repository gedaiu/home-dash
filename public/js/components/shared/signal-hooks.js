import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';

export function useSignalMirror(signal, initialValue) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => effect(() => setValue(signal.value)), []);

  return [value, setValue];
}

export function useSignalValue(signal) {
  const [value] = useSignalMirror(signal, signal.value);

  return value;
}
