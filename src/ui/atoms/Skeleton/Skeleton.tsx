/* Skeleton — пульсирующая заставка для контента, который ещё грузится. */

import { h, type HTMLAttributes } from 'preact';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  count?: number;
  height?: string;
}

export function Skeleton({
  count = 3,
  height = '52px',
  ...rest
}: SkeletonProps): import('preact').JSX.Element {
  const rows = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      class="sk-row"
      style={{ height, animation: `shimmer 1.4s infinite linear ${i * 0.2}s` }}
    />
  ));
  return (
    <div class="skeleton" {...rest}>
      {rows}
    </div>
  );
}

export default Skeleton;