/**
 * 红线看板主页面
 */

import React from 'react';
import { Tabs } from 'antd';
import Upload from './Upload';
import Display from './Display';
import Comparison from './Comparison';

const RedLine: React.FC = () => {
  const items = [
    {
      key: 'upload',
      label: '数据上传',
      children: <Upload />,
    },
    {
      key: 'display',
      label: '数据展示',
      children: <Display />,
    },
    {
      key: 'comparison',
      label: '红线对比',
      children: <Comparison />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '24px' }}>红线看板</h2>
      <Tabs items={items} defaultActiveKey="upload" />
    </div>
  );
};

export default RedLine;
