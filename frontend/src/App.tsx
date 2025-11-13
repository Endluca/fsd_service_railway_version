import React, { useState, useEffect } from 'react';
import {
  Layout,
  DatePicker,
  Select,
  Button,
  Table,
  Typography,
  Space,
  message,
  Tag,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { queryDashboard, getGroups, getSales } from './services/api';
import type { SalesData } from './types';
import './App.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 汇总统计接口
interface SummaryStatistics {
  totalMessages: number;
  overallTimelyRate: number;
  overallOvertimeRate: number;
  overallAvgDuration: number;
  totalConversations: number;
  newRuleTotalMessages: number;
  totalOvertimeReply: number;
  totalOvertimeNoReply: number;
}

// 计算汇总统计（加权平均）
const calculateSummaryStats = (salesData: SalesData[]): SummaryStatistics => {
  if (salesData.length === 0) {
    return {
      totalMessages: 0,
      overallTimelyRate: 0,
      overallOvertimeRate: 0,
      overallAvgDuration: 0,
      totalConversations: 0,
      newRuleTotalMessages: 0,
      totalOvertimeReply: 0,
      totalOvertimeNoReply: 0,
    };
  }

  const totalCount = salesData.reduce((sum, item) => sum + item.customerTurnCount, 0);
  const totalConversations = salesData.reduce((sum, item) => sum + item.conversationCount, 0);
  const newRuleTotalMessages = salesData.reduce((sum, item) => sum + item.newRuleCustomerTurnCount, 0);
  const totalOvertimeReply = salesData.reduce((sum, item) => sum + item.overtimeReplyCount, 0);
  const totalOvertimeNoReply = salesData.reduce((sum, item) => sum + item.overtimeNoReplyCount, 0);

  if (totalCount === 0) {
    return {
      totalMessages: 0,
      overallTimelyRate: 0,
      overallOvertimeRate: 0,
      overallAvgDuration: 0,
      totalConversations: totalConversations,
      newRuleTotalMessages: newRuleTotalMessages,
      totalOvertimeReply: totalOvertimeReply,
      totalOvertimeNoReply: totalOvertimeNoReply,
    };
  }

  return {
    totalMessages: totalCount,
    overallTimelyRate:
      salesData.reduce((sum, item) => sum + item.timelyReplyRate * item.customerTurnCount, 0) / totalCount,
    overallOvertimeRate:
      salesData.reduce((sum, item) => sum + item.overtimeReplyRate * item.customerTurnCount, 0) / totalCount,
    overallAvgDuration:
      salesData.reduce((sum, item) => sum + item.avgReplyDuration * item.customerTurnCount, 0) / totalCount,
    totalConversations: totalConversations,
    newRuleTotalMessages: newRuleTotalMessages,
    totalOvertimeReply: totalOvertimeReply,
    totalOvertimeNoReply: totalOvertimeNoReply,
  };
};

const App: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(10, 'days'),
    dayjs(),
  ]);
  const [groups, setGroups] = useState<string[]>([]);
  const [salesList, setSalesList] = useState<{ openUserId: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
  const [selectedSales, setSelectedSales] = useState<string | undefined>();
  const [data, setData] = useState<SalesData[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 加载小组列表
  useEffect(() => {
    loadGroups();
  }, []);

  // 当选择小组时，加载该小组的销售列表
  useEffect(() => {
    if (selectedGroup) {
      loadSales(selectedGroup);
    } else {
      setSalesList([]);
      setSelectedSales(undefined);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    try {
      const groupList = await getGroups();
      setGroups(groupList);
    } catch (error) {
      message.error('加载小组列表失败');
    }
  };

  const loadSales = async (groupName?: string) => {
    try {
      const sales = await getSales(groupName);
      setSalesList(sales);
    } catch (error) {
      message.error('加载销售列表失败');
    }
  };

  // 查询数据
  const handleQuery = async () => {
    if (!dateRange) {
      message.warning('请选择日期范围');
      return;
    }

    setLoading(true);
    try {
      const [start, end] = dateRange;
      const params = {
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        groupName: selectedGroup,
        openUserId: selectedSales,
      };

      const result = await queryDashboard(params);
      setData(result);
      setPagination({ ...pagination, total: result.length, current: 1 });
      message.success('查询成功');
    } catch (error: any) {
      message.error(error.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<SalesData> = [
    {
      title: '小组',
      dataIndex: 'groupName',
      key: 'groupName',
      width: 150,
      sorter: (a, b) => (a.groupName || '').localeCompare(b.groupName || ''),
      render: (text) => text || '-',
    },
    {
      title: 'CM',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '总消息数',
      dataIndex: 'customerTurnCount',
      key: 'customerTurnCount',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.customerTurnCount - b.customerTurnCount,
    },
    {
      title: '新规则总消息数',
      dataIndex: 'newRuleCustomerTurnCount',
      key: 'newRuleCustomerTurnCount',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.newRuleCustomerTurnCount - b.newRuleCustomerTurnCount,
    },
    {
      title: '超时回复数',
      dataIndex: 'overtimeReplyCount',
      key: 'overtimeReplyCount',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.overtimeReplyCount - b.overtimeReplyCount,
    },
    {
      title: '超时未回复数',
      dataIndex: 'overtimeNoReplyCount',
      key: 'overtimeNoReplyCount',
      width: 130,
      align: 'center',
      sorter: (a, b) => a.overtimeNoReplyCount - b.overtimeNoReplyCount,
    },
    {
      title: '及时回复率',
      dataIndex: 'timelyReplyRate',
      key: 'timelyReplyRate',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.timelyReplyRate - b.timelyReplyRate,
      render: (value: number) => (
        <Tag color={value >= 80 ? 'success' : value >= 60 ? 'warning' : 'error'}>
          {value.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '超时回复率',
      dataIndex: 'overtimeReplyRate',
      key: 'overtimeReplyRate',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.overtimeReplyRate - b.overtimeReplyRate,
      render: (value: number) => (
        <Tag color={value <= 20 ? 'success' : value <= 40 ? 'warning' : 'error'}>
          {value.toFixed(2)}%
        </Tag>
      ),
    },
    {
      title: '平均回复时长',
      dataIndex: 'avgReplyDuration',
      key: 'avgReplyDuration',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.avgReplyDuration - b.avgReplyDuration,
      render: (value: number) => {
        const hours = Math.floor(value / 60);
        const minutes = Math.floor(value % 60);
        return `${hours}:${minutes}分钟`;
      },
    },
    {
      title: '会话数',
      dataIndex: 'conversationCount',
      key: 'conversationCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.conversationCount - b.conversationCount,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#fff',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        height: 'auto',
        lineHeight: 'normal'
      }}>
        <Title level={3} style={{ margin: '0 0 12px 0' }}>
          51Talk CM团队服务及时性监控看板
        </Title>
        <div style={{ fontWeight: 'bold', color: '#ff4d4f', fontSize: '14px', marginBottom: '0' }}>
          UTC+3时，数据每日00:30左右更新至昨日，单日统计范围为昨日21点至当日21点。
        </div>
      </Header>

      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
          {/* 筛选区域 */}
          <Space size="middle" wrap style={{ marginBottom: 24 }}>
            <Space>
              <Text>日期范围:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
                format="YYYY-MM-DD"
              />
            </Space>

            <Space>
              <Text>小组:</Text>
              <Select
                placeholder="全部小组"
                style={{ width: 200 }}
                allowClear
                value={selectedGroup}
                onChange={setSelectedGroup}
                options={[
                  { label: '全部小组', value: undefined },
                  ...groups.map((g) => ({ label: g, value: g })),
                ]}
              />
            </Space>

            <Space>
              <Text>销售BCM:</Text>
              <Select
                placeholder="全部BCM"
                style={{ width: 200 }}
                allowClear
                value={selectedSales}
                onChange={setSelectedSales}
                disabled={!selectedGroup}
                options={[
                  { label: '全部BCM', value: undefined },
                  ...salesList.map((s) => ({ label: s.name, value: s.openUserId })),
                ]}
              />
            </Space>

            <Button type="primary" onClick={handleQuery} loading={loading}>
              查询数据
            </Button>
          </Space>

          {/* 汇总统计 */}
          {data.length > 0 && (() => {
            const summary = calculateSummaryStats(data);
            return (
              <div
                style={{
                  marginTop: 24,
                  marginBottom: 24,
                  padding: '20px',
                  background: '#fafafa',
                  borderRadius: '8px',
                  border: '1px solid #e8e8e8',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '16px', color: '#333' }}>
                  整体数据汇总
                </div>
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="总消息数"
                      value={summary.totalMessages}
                      suffix="条"
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="整体及时回复率"
                      value={summary.overallTimelyRate}
                      precision={2}
                      suffix="%"
                      valueStyle={{
                        color:
                          summary.overallTimelyRate >= 80
                            ? '#52c41a'
                            : summary.overallTimelyRate >= 60
                            ? '#faad14'
                            : '#ff4d4f',
                      }}
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="整体超时回复率"
                      value={summary.overallOvertimeRate}
                      precision={2}
                      suffix="%"
                      valueStyle={{
                        color:
                          summary.overallOvertimeRate <= 20
                            ? '#52c41a'
                            : summary.overallOvertimeRate <= 40
                            ? '#faad14'
                            : '#ff4d4f',
                      }}
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="平均回复时长"
                      value={`${Math.floor(summary.overallAvgDuration / 60)}小时${Math.floor(summary.overallAvgDuration % 60)}分钟`}
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="总会话数"
                      value={summary.totalConversations}
                      suffix="个"
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="新规则总消息数"
                      value={summary.newRuleTotalMessages}
                      suffix="条"
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="超时回复总数"
                      value={summary.totalOvertimeReply}
                      suffix="次"
                    />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Statistic
                      title="超时未回复总数"
                      value={summary.totalOvertimeNoReply}
                      suffix="次"
                    />
                  </Col>
                </Row>
              </div>
            );
          })()}

          {/* 数据表格 */}
          <Table
            columns={columns}
            dataSource={data}
            rowKey="openUserId"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
            }}
            scroll={{ x: 1000 }}
          />

          {/* 数据定义说明 */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: '1.8',
            color: '#666'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>数据定义说明：</div>
            <div>• 总消息数 = 用户在查询时间范围内的发言总轮次（排除未响应轮次）</div>
            <div>• 及时回复率 = 查询时间范围内销售及时回复轮次（含AI回复轮次） / 总消息数 × 100%</div>
            <div>• 超时回复率 = 查询时间范围内销售超时回复轮次（含AI回复轮次） / 总消息数 × 100%</div>
            <div>• 平均回复时长 = 查询时间范围内销售回复总时长（含AI回复轮次） / 总消息数</div>
            <div>• 及时回复率 + 超时回复率 = 1</div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default App;
