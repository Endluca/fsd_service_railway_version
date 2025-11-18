import React, { useState } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  LineChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '1小时服务及时度 看板',
    },
    {
      key: '/trend',
      icon: <LineChartOutlined />,
      label: '服务及时度趋势对比',
    },
    {
      key: '/topicmining',
      icon: <FileTextOutlined />,
      label: '话题挖掘',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
          height: 'auto',
          lineHeight: 'normal',
        }}
      >
        <Title level={3} style={{ margin: '0 0 12px 0' }}>
          51Talk - 客户亲密仪表盘
        </Title>
        <div
          style={{
            fontWeight: 'bold',
            color: '#ff4d4f',
            fontSize: '14px',
            marginBottom: '0',
          }}
        >
          UTC+3时，数据每日00:30左右更新至昨日，单日统计范围为昨日21点至当日21点。
        </div>
      </Header>

      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={220}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>

        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
