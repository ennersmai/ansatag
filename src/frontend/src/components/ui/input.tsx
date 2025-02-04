import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          className={`
            w-full
            bg-white
            rounded-md
            border-2
            border-gray-200
            px-3
            py-2
            text-sm
            placeholder:text-gray-500
            focus:outline-none
            focus:border-blue-500
            disabled:cursor-not-allowed
            disabled:opacity-50
            ${className}
          `}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input; 