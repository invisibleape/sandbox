import React from 'react';
import Dashboard from './components/Dashboard';
import { AuthWrapper } from './components/AuthWrapper';

function App() {
  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gray-50">
        <Dashboard />
      </div>
    </AuthWrapper>
  );
}

export default App;