import React, { useState, useEffect } from 'react';
import {
  Space,
  Radio,
  DatePicker,
  Select,
  Button,
  message,
  Typography,
  Card,
  Spin,
} from 'antd';
import { Line } from '@ant-design/charts';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type {
  Granularity,
  ComparisonType,
  MetricType,
  TrendResponse,
  DateRange,
} from '../types';
import { getTrendData, getTrendDateRange, getGroups } from '../services/api';

dayjs.extend(isoWeek);

const { Text } = Typography;
const { RangePicker } = DatePicker;

// 指标选项
const metricOptions = [
  { label: '及时回复率（%）', value: 'timelyReplyRate' },
  { label: '超时回复率（%）', value: 'overtimeReplyRate' },
  { label: '平均回复时长（分钟）', value: 'avgReplyDuration' },
  { label: '会话数', value: 'conversationCount' },
];

// 生成高对比度颜色方案
const generateColors = (count: number): string[] => {
  const baseColors = [
    '#1890ff', // 蓝色
    '#52c41a', // 绿色
    '#fa541c', // 橙色
    '#722ed1', // 紫色
    '#13c2c2', // 青色
    '#eb2f96', // 粉色
    '#faad14', // 金色
    '#2f54eb', // 深蓝
    '#a0d911', // 黄绿
    '#f5222d', // 红色
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // 如果需要更多颜色，生成更多颜色
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.5) % 360; // 黄金角度分布
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};

const TrendComparison: React.FC = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('all');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [metric, setMetric] = useState<MetricType>('timelyReplyRate');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [availableDateRange, setAvailableDateRange] = useState<DateRange | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);

  // 加载初始数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 加载可用日期范围
      const dateRangeData = await getTrendDateRange();
      if (dateRangeData) {
        setAvailableDateRange(dateRangeData);
        // 设置默认日期范围为最近7天
        const end = dayjs(dateRangeData.endDate);
        const start = end.subtract(6, 'day');
        setDateRange([start, end]);
      }

      // 加载小组列表
      const groupsData = await getGroups();
      setGroups(groupsData);
    } catch (error) {
      console.error('加载初始数据失败:', error);
      message.error('加载初始数据失败');
    }
  };

  // 当对比类型或小组改变时，重置数据
  useEffect(() => {
    if (comparisonType !== 'person') {
      setSelectedGroup(undefined);
    }
    setTrendData(null);
  }, [comparisonType]);

  // 查询数据
  const handleQuery = async () => {
    if (!dateRange) {
      message.warning('请选择时间范围');
      return;
    }

    if (comparisonType === 'person' && !selectedGroup) {
      message.warning('请选择小组');
      return;
    }

    // 周粒度校验
    if (granularity === 'week') {
      const [start, end] = dateRange;
      if (start.isoWeekday() !== 1) {
        message.warning('周粒度时，开始日期必须是周一');
        return;
      }
      if (end.isoWeekday() !== 7) {
        message.warning('周粒度时，结束日期必须是周日');
        return;
      }
    }

    setLoading(true);
    try {
      const data = await getTrendData({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        granularity,
        comparisonType,
        groupName: selectedGroup,
        metric,
      });

      setTrendData(data);

      if (data.series.length === 0) {
        message.info('暂无数据');
      }
    } catch (error: any) {
      console.error('查询失败:', error);
      message.error(error.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 禁用不可选的日期
  const disabledDate = (current: Dayjs) => {
    if (!availableDateRange) return false;

    const minDate = dayjs(availableDateRange.startDate);
    const maxDate = dayjs(availableDateRange.endDate);

    return current.isBefore(minDate, 'day') || current.isAfter(maxDate, 'day');
  };

  // 获取指标单位
  const getMetricUnit = (metricType: MetricType): string => {
    switch (metricType) {
      case 'timelyReplyRate':
      case 'overtimeReplyRate':
        return '%';
      case 'avgReplyDuration':
        return '分钟';
      case 'conversationCount':
        return '个';
      default:
        return '';
    }
  };

  // 获取指标名称
  const getMetricName = (metricType: MetricType): string => {
    const option = metricOptions.find(opt => opt.value === metricType);
    return option ? option.label : metricType;
  };

  // 准备图表配置
  const getChartConfig = () => {
    if (!trendData || trendData.series.length === 0) return null;

    const colors = generateColors(trendData.lines.length);

    return {
      data: trendData.series,
      xField: 'date',
      yField: 'value',
      seriesField: 'name',
      smooth: true,
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
      color: colors,
      point: {
        size: 4,
        shape: 'circle',
        style: {
          fill: 'white',
          stroke: '#5B8FF9',
          lineWidth: 2,
        },
      },
      tooltip: {
        showCrosshairs: true,
        shared: true,
        formatter: (datum: any) => {
          return {
            name: datum.name,
            value: `${datum.value.toFixed(2)}${getMetricUnit(metric)}`,
          };
        },
      },
      legend: {
        position: 'bottom' as const,
        itemName: {
          style: {
            fontSize: 14,
          },
        },
      },
      xAxis: {
        label: {
          autoHide: true,
          autoRotate: false,
        },
        title: {
          text: granularity === 'day' ? '日期' : '周',
          style: {
            fontSize: 14,
          },
        },
      },
      yAxis: {
        title: {
          text: getMetricName(metric),
          style: {
            fontSize: 14,
          },
        },
      },
      interactions: [
        {
          type: 'marker-active',
        },
      ],
    };
  };

  const chartConfig = getChartConfig();

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 筛选区域 */}
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 对比层级选择 */}
          <Space wrap>
            <Text strong>对比层级:</Text>
            <Radio.Group
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value)}
            >
              <Radio.Button value="all">全部人对比</Radio.Button>
              <Radio.Button value="group">组对比</Radio.Button>
              <Radio.Button value="person">人对比</Radio.Button>
            </Radio.Group>
          </Space>

          {/* 时间颗粒度选择 */}
          <Space wrap>
            <Text strong>时间颗粒度:</Text>
            <Radio.Group
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
            >
              <Radio.Button value="day">日</Radio.Button>
              <Radio.Button value="week">周</Radio.Button>
            </Radio.Group>
            {granularity === 'week' && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                （周粒度需选择完整周：周一至周日）
              </Text>
            )}
          </Space>

          {/* 时间范围和指标选择 */}
          <Space wrap>
            <Space>
              <Text strong>时间范围:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
                format="YYYY-MM-DD"
                disabledDate={disabledDate}
              />
            </Space>

            <Space>
              <Text strong>指标:</Text>
              <Select
                value={metric}
                onChange={setMetric}
                style={{ width: 180 }}
                options={metricOptions}
              />
            </Space>

            {/* 小组选择（仅人对比时显示） */}
            {comparisonType === 'person' && (
              <Space>
                <Text strong>小组:</Text>
                <Select
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  placeholder="请选择小组"
                  style={{ width: 200 }}
                  options={groups.map((g) => ({ label: g, value: g }))}
                />
              </Space>
            )}

            <Button type="primary" onClick={handleQuery} loading={loading}>
              查询
            </Button>
          </Space>
        </Space>

        {/* 图表区域 */}
        <div style={{ marginTop: '32px', minHeight: '400px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" tip="加载中..." />
            </div>
          ) : chartConfig ? (
            <Line {...chartConfig} />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '100px 0',
                color: '#999',
                fontSize: '16px',
              }}
            >
              请选择筛选条件并点击"查询"按钮查看趋势图
            </div>
          )}
        </div>

        {/* 说明 */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: '1.8',
            color: '#666',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            使用说明：
          </div>
          <div>• 全部人对比：展示全公司整体指标随时间变化的趋势</div>
          <div>• 组对比：对比不同小组的指标趋势，每条线代表一个小组</div>
          <div>• 人对比：对比同一小组内不同人员的指标趋势，需先选择小组</div>
          <div>• 周粒度：必须选择完整周（周一到周日），数据按周聚合计算</div>
        </div>
      </Card>
    </div>
  );
};

export default TrendComparison;
