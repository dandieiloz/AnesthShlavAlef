interface DisclaimerProps {
  text: string;
  className?: string;
}

export function Disclaimer({ text, className }: DisclaimerProps) {
  return (
    <p
      className={`text-center text-xs text-red-600 dark:text-red-400${
        className ? ` ${className}` : ""
      }`}
    >
      {text}
    </p>
  );
}
