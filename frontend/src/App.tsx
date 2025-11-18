import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Trend from './pages/Trend';
import TopicMining from './pages/TopicMining';
import './App.css';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout><Navigate to="/dashboard" replace /></MainLayout>} />
        <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
        <Route path="/trend" element={<MainLayout><Trend /></MainLayout>} />
        <Route path="/topicmining" element={<MainLayout><TopicMining /></MainLayout>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
