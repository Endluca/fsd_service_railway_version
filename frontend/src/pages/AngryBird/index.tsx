/**
 * 愤怒小鸟主页面
 * 包含导入数据和数据展示两个 Tab
 */

import React from 'react';
import { Tabs } from 'antd';
import Upload from './Upload';
import Display from './Display';

const AngryBird: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <h2>愤怒小鸟</h2>
      <Tabs
        defaultActiveKey="upload"
        items={[
          {
            key: 'upload',
            label: '导入数据',
            children: <Upload />,
          },
          {
            key: 'display',
            label: '数据展示',
            children: <Display />,
          },
        ]}
      />
    </div>
  );
};

export default AngryBird;
