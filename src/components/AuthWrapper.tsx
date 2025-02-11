import React, { useState, useEffect } from 'react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const auth = window.localStorage.getItem('auth');
      if (!auth) {
        promptForCredentials();
        return;
      }

      const [username, password] = atob(auth).split(':');
      if (username === 'fred11' && password === 'yDRdE5ngQ4R*ezT') {
        setIsAuthenticated(true);
      } else {
        window.localStorage.removeItem('auth');
        promptForCredentials();
      }
    };

    const promptForCredentials = () => {
      const credentials = window.prompt('Please enter your credentials (username:password)');
      if (!credentials) {
        promptForCredentials();
        return;
      }

      const [username, password] = credentials.split(':');
      if (username === 'fred11' && password === 'yDRdE5ngQ4R*ezT') {
        window.localStorage.setItem('auth', btoa(`${username}:${password}`));
        setIsAuthenticated(true);
      } else {
        alert('Invalid credentials');
        promptForCredentials();
      }
    };

    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}