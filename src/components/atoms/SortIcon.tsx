import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface SortIconProps {
  columnKey: string;
  activeKey: string;
  order: 'asc' | 'desc';
}

export function SortIcon({ columnKey, activeKey, order }: SortIconProps) {
  if (activeKey !== columnKey)
    return <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover/head:opacity-100 transition-opacity ml-1" />;
  return order === 'asc'
    ? <ChevronUp   className="w-2.5 h-2.5 text-primary ml-1" />
    : <ChevronDown className="w-2.5 h-2.5 text-primary ml-1" />;
}
