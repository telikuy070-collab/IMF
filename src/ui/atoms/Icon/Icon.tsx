/* Иконка-компонент. Принимает path SVG и опциональные размеры/цвет. */

import { h, type HTMLAttributes } from 'preact';

export interface IconProps extends Omit<HTMLAttributes<SVGSVGElement>, 'role'> {
  path: string;
  size?: number;
  color?: string;
}

export function Icon({
  path,
  size = 22,
  color,
  ...rest
}: IconProps): import('preact').JSX.Element {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={path} />
    </svg>
  );
}

export default Icon;