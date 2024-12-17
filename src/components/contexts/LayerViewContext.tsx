import { createContext } from 'react';

export const LayerViewContext = createContext<{
  highlight: (target: __esri.Graphic | __esri.Graphic[] | number | number[] | string | string[]) => __esri.Handle;
  setFilterEffect: (effect: __esri.Effect) => void;
} | null>(null);
