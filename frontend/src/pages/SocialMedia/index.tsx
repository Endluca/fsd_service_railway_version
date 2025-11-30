import React, { useState } from 'react';
import { Typography, Tabs } from 'antd';
import Search from './Search';
import History from './History';

const { Title } = Typography;

const SocialMedia: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSearchComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
      <Title level={2}>社媒声音</Title>

      <Tabs
        defaultActiveKey="search"
        items={[
          {
            key: 'search',
            label: '搜索监控',
            children: <Search onSearchComplete={handleSearchComplete} />,
          },
          {
            key: 'history',
            label: '搜索历史',
            children: <History refreshTrigger={refreshTrigger} />,
          },
        ]}
      />
    </div>
  );
};

export default SocialMedia;
