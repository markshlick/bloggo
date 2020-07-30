import {
  PropsWithChildren,
  CSSProperties,
  InputHTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';

export type Styles = {
  style?: CSSProperties;
  className?: string;
};

export const ButtonUnstyled = ({
  className,
  ...props
}: ButtonHTMLAttributes<{}>) => (
  <button
    className={`button-unstyled ${className}`}
    {...props}
  />
);

export const PageContainer = ({
  children,
}: PropsWithChildren<{}>) => (
  <div className="container">{children}</div>
);

export const Section = ({
  children,
}: PropsWithChildren<{}>) => (
  <div className="section">{children}</div>
);

export const Box = ({
  v,
  children,
}: PropsWithChildren<{ v?: boolean }>) => (
  <div className={v ? 'box-v' : 'box'}>{children}</div>
);

export const Right = ({
  children,
}: PropsWithChildren<{}>) => (
  <div className="right">{children}</div>
);

export const Space = ({
  s,
  children,
}: PropsWithChildren<{ s?: boolean }>) => (
  <div className={s ? 'space-small' : 'space'}>
    {children}
  </div>
);

export const SpaceInline = ({
  children,
}: PropsWithChildren<{}>) => (
  <span className="space-inline">{children}</span>
);
