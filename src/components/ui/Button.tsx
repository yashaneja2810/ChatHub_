import React from 'react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white focus:ring-blue-400 dark:bg-gradient-to-r dark:from-blue-800 dark:via-indigo-900 dark:to-black dark:hover:from-blue-900 dark:hover:to-black',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-gray-400 dark:bg-black dark:hover:bg-gray-900 dark:text-white',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white focus:ring-red-400 dark:bg-gradient-to-r dark:from-red-800 dark:to-black dark:hover:from-red-900 dark:hover:to-black',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 focus:ring-gray-400 dark:bg-transparent dark:hover:bg-gray-900 dark:text-gray-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </motion.button>
  );
};