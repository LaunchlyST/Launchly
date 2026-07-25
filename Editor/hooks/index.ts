import { useState, useEffect, useCallback, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

export function useKeyPress(targetKey: string, handler: () => void, target?: HTMLElement | Document | Window): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const element = target || window;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === targetKey) handlerRef.current();
    };
    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [targetKey, target]);
}

export function useShortcut(shortcut: string, handler: () => void, target?: HTMLElement | Document | Window): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const element = target || window;
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = shortcut.toLowerCase().split('+');
      const match = keys.every((k) => {
        if (k === 'ctrl') return e.ctrlKey;
        if (k === 'shift') return e.shiftKey;
        if (k === 'alt') return e.altKey;
        if (k === 'meta') return e.metaKey;
        return e.key.toLowerCase() === k;
      });
      if (match) {
        e.preventDefault();
        handlerRef.current();
      }
    };
    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, target]);
}

export function useDragDrop<T>(options: {
  onDragStart: (data: T) => void;
  onDragOver: (e: DragEvent) => boolean;
  onDrop: (data: T, position: { x: number; y: number }) => void;
  onDragEnd: () => void;
}): { dragRef: React.RefObject<HTMLDivElement>; isDragging: boolean } {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<T | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    const data = options.onDragStart(e.currentTarget.dataset);
    if (data) {
      dragDataRef.current = data;
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
    }
  }, [options]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (options.onDragOver(e.nativeEvent)) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, [options]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragDataRef.current) {
      const rect = dragRef.current?.getBoundingClientRect();
      const position = rect
        ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
        : { x: e.clientX, y: e.clientY };
      options.onDrop(dragDataRef.current, position);
    }
    setIsDragging(false);
    dragDataRef.current = null;
  }, [options]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragDataRef.current = null;
    options.onDragEnd();
  }, [options]);

  const props = {
    ref: dragRef,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
    draggable: true,
  };

  return { dragRef, isDragging, props };
}

export function useAnimationFrame(callback: (time: number) => void): void {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      callback(time - previousTimeRef.current);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);
}

export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function useClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function useHover(): [React.RefObject<HTMLDivElement>, boolean] {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => setHovered(true);
    const handleMouseLeave = () => setHovered(false);

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return [ref, hovered];
}

export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  const savedListener = useRef(listener);
  savedListener.current = listener;

  useEffect(() => {
    const handler = (event: WindowEventMap[K]) => savedListener.current(event);
    window.addEventListener(type, handler, options);
    return () => window.removeEventListener(type, handler, options);
  }, [type, options]);
}