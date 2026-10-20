/**
 * @fileoverview Phase 2 Demo Component
 * @description A comprehensive demo showcasing all Phase 2 UI/UX features
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState } from 'react';

/**
 * @description Phase 2 Demo Component
 * @returns Demo component showcasing Phase 2 features
 */
export const Phase2Demo: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'login'>('dashboard');
  const [user, setUser] = useState<{
    id: string;
    username: string;
    email: string;
    role: string;
    points: number;
    level: number;
  } | null>({
    id: '1',
    username: 'Alex',
    email: 'alex@example.com',
    role: 'parent',
    points: 1250,
    level: 8,
  });

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
  };

  const handleLogin = (data: any) => {
    console.log('Login data:', data);
    setUser({
      id: '1',
      username: 'Alex',
      email: 'alex@example.com',
      role: 'parent',
      points: 1250,
      level: 8,
    });
    setCurrentView('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">TaaskMaaster</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <span className="text-sm text-gray-700">
                    Welcome, {user.username} (Level {user.level})
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'login' ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Welcome to TaaskMaaster
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                A comprehensive task management system for families
              </p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleLogin({ email: 'demo@example.com', password: 'demo' });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue="demo@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      defaultValue="demo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome back, {user?.username}!
              </h2>
              <p className="text-gray-600">
                You&apos;re doing great! Keep up the good work with your tasks.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-medium">✓</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Tasks Completed</p>
                    <p className="text-2xl font-semibold text-gray-900">24</p>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-sm font-medium">🔥</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Current Streak</p>
                    <p className="text-2xl font-semibold text-gray-900">7 days</p>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 text-sm font-medium">⭐</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Points Earned</p>
                    <p className="text-2xl font-semibold text-gray-900">{user?.points}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-sm font-medium">🎯</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Goals Achieved</p>
                    <p className="text-2xl font-semibold text-gray-900">3</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Level Progress</h3>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Level {user?.level}</span>
                    <span>1250 / 1500 points</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '83%' }}></div>
                  </div>
                </div>
                <span className="text-sm text-gray-500">83%</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium">
                  Create New Task
                </button>
                <button className="bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 font-medium">
                  Set New Goal
                </button>
                <button className="bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 font-medium">
                  View Achievements
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
