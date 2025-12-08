import React, { useState, useEffect } from 'react';
import {
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
import type { Dayjs } from 'dayjs';
import { queryDashboard, getGroups, getSales } from '../../services/api';
import type { SalesData } from '../../types';
import { useDashboardStore } from '../../stores/useDashboardStore';

const { Text } = Typography;
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

// 按小组聚合数据
const aggregateByGroup = (salesData: SalesData[]): SalesData[] => {
  if (salesData.length === 0) {
    return [];
  }

  const groupMap = new Map<string, {
    customerTurnCount: number;
    timelyReplyCount: number;
    overtimeReplyCount: number;
    totalReplyDuration: number;
    newRuleCustomerTurnCount: number;
    overtimeReplyCountValue: number;
    overtimeNoReplyCount: number;
    conversationCount: number;
  }>();

  // 按小组聚合数据
  for (const item of salesData) {
    const group = item.groupName || '未分配小组';
    if (!groupMap.has(group)) {
      groupMap.set(group, {
        customerTurnCount: 0,
        timelyReplyCount: 0,
        overtimeReplyCount: 0,
        totalReplyDuration: 0,
        newRuleCustomerTurnCount: 0,
        overtimeReplyCountValue: 0,
        overtimeNoReplyCount: 0,
        conversationCount: 0,
      });
    }
    const data = groupMap.get(group)!;
    data.customerTurnCount += item.customerTurnCount;
    // 通过百分比反推计数（会有精度损失，但可接受）
    const timelyCount = (item.timelyReplyRate / 100) * item.customerTurnCount;
    const overtimeCount = (item.overtimeReplyRate / 100) * item.customerTurnCount;
    data.timelyReplyCount += timelyCount;
    data.overtimeReplyCount += overtimeCount;
    data.totalReplyDuration += item.avgReplyDuration * item.customerTurnCount;
    data.newRuleCustomerTurnCount += item.newRuleCustomerTurnCount;
    data.overtimeReplyCountValue += item.overtimeReplyCount;
    data.overtimeNoReplyCount += item.overtimeNoReplyCount;
    data.conversationCount += item.conversationCount;
  }

  // 转换为SalesData格式
  return Array.from(groupMap.entries()).map(([groupName, data]) => ({
    openUserId: `group_${groupName}`, // 使用特殊前缀作为唯一标识
    name: '', // 小组汇总不显示CM
    groupName,
    customerTurnCount: data.customerTurnCount,
    timelyReplyRate: data.customerTurnCount > 0
      ? (data.timelyReplyCount / data.customerTurnCount) * 100
      : 0,
    overtimeReplyRate: data.customerTurnCount > 0
      ? (data.overtimeReplyCount / data.customerTurnCount) * 100
      : 0,
    avgReplyDuration: data.customerTurnCount > 0
      ? data.totalReplyDuration / data.customerTurnCount
      : 0,
    newRuleCustomerTurnCount: data.newRuleCustomerTurnCount,
    overtimeReplyCount: data.overtimeReplyCountValue,
    overtimeNoReplyCount: data.overtimeNoReplyCount,
    conversationCount: data.conversationCount,
  }));
};

const Dashboard: React.FC = () => {
  // 从store获取状态和actions
  const {
    dateRange,
    selectedGroups,
    selectedSales,
    data,
    pagination,
    setDateRange,
    setSelectedGroups,
    setSelectedSales,
    setData,
    setPagination,
  } = useDashboardStore();

  // 本地状态（不需要持久化的状态）
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [salesList, setSalesList] = useState<{ openUserId: string; name: string; groupName: string | null }[]>([]);

  // 加载小组列表
  useEffect(() => {
    loadGroups();
  }, []);

  // 当选择小组或日期范围改变时，加载该小组在该时间范围内有数据的销售列表
  useEffect(() => {
    if (selectedGroups.length > 0 && dateRange && dateRange[0] && dateRange[1]) {
      loadSales(selectedGroups, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    } else if (selectedGroups.length > 0) {
      // 如果只选择了小组但没有日期，则加载该小组所有销售
      loadSales(selectedGroups);
    } else {
      setSalesList([]);
      setSelectedSales([]);
    }
  }, [selectedGroups, dateRange]);

  const loadGroups = async () => {
    try {
      const groupList = await getGroups();
      setGroups(groupList);
    } catch (error) {
      message.error('加载小组列表失败');
    }
  };

  const loadSales = async (groupNames?: string[], startDate?: string, endDate?: string) => {
    try {
      const sales = await getSales(groupNames, startDate, endDate);
      // 过滤掉无效数据并去重
      const uniqueSales = sales
        .filter((sale) => sale.openUserId && sale.openUserId.trim() !== '') // 确保有有效的 openUserId
        .filter(
          (sale, index, self) =>
            index === self.findIndex((s) => s.openUserId === sale.openUserId) // 去重
        );
      setSalesList(uniqueSales);

      // 如果当前选中的销售不在新列表中，清空选择
      if (selectedSales.length > 0) {
        const validSelectedSales = selectedSales.filter(saleId =>
          uniqueSales.find(s => s.openUserId === saleId)
        );
        if (validSelectedSales.length !== selectedSales.length) {
          setSelectedSales(validSelectedSales);
        }
      }
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
        groupNames: selectedGroups.length > 0 ? selectedGroups : undefined,
        openUserIds: selectedSales.length > 0 ? selectedSales : undefined,
      };

      const result = await queryDashboard(params);

      // 如果未选择小组，则进行前端聚合，显示小组汇总数据
      let finalData: SalesData[];
      if (selectedGroups.length === 0) {
        finalData = aggregateByGroup(result);
      } else {
        finalData = result;
      }

      setData(finalData);
      setPagination({ ...pagination, total: finalData.length, current: 1 });
      message.success('查询成功');
    } catch (error: any) {
      message.error(error.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 动态表格列定义：根据是否选择小组来决定是否显示CM列
  const getColumns = (showCMColumn: boolean): ColumnsType<SalesData> => {
    const columns: ColumnsType<SalesData> = [
      {
        title: '小组',
        dataIndex: 'groupName',
        key: 'groupName',
        width: 150,
        sorter: (a, b) => (a.groupName || '').localeCompare(b.groupName || ''),
        render: (text) => text || '-',
      },
    ];

    // 如果选择了小组，则显示CM列
    if (showCMColumn) {
      columns.push({
        title: 'CM',
        dataIndex: 'name',
        key: 'name',
        width: 150,
        sorter: (a, b) => a.name.localeCompare(b.name),
      });
    }

    // 添加其他列
    columns.push(
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
      }
    );

    return columns;
  };

  return (
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
            style={{ width: 300 }}
            mode="multiple"
            allowClear
            value={selectedGroups}
            onChange={setSelectedGroups}
            options={groups.map((g) => ({ label: g, value: g }))}
            maxTagCount="responsive"
          />
        </Space>

        <Space>
          <Text>销售CM:</Text>
          <Select
            placeholder="全部CM"
            style={{ width: 300 }}
            mode="multiple"
            allowClear
            value={selectedSales}
            onChange={setSelectedSales}
            disabled={selectedGroups.length === 0}
            options={salesList.map((s) => ({
              label: `${s.name} (${s.groupName || '未分配'})`,
              value: s.openUserId,
            }))}
            maxTagCount="responsive"
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
        columns={getColumns(selectedGroups.length > 0)}
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
  );
};

export default Dashboard;
